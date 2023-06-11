const { select, prompt, format } = require('ariex-cli-wrapper')
const os = require('os')
const fs = require('fs-extra')
const path = require('path')
const childProcess = require('child_process')

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

class VSRunner {
  config = null
  allProjects = []
  projectsPages = []
  _currentPage = 0
  defaultRenderFunc = this.renderPage

  get currentPage() {
    return this._currentPage
  }
  set currentPage(page) {
    this._currentPage = clamp(page, 0, this.projectsPages.length - 1)
  }

  constructor() {
    this.initConfig()
    this.processCliArg()
    this.loadProjects()
    this.defaultRenderFunc()
  }

  renderPage(defaultValue = 0) {
    const menu = {}
    const projects = this.projectsPages[this.currentPage]

    console.clear()
    menu[format.green('New project..')] = async () => {
      await this.renderNewProject()
    }

    if (this.projectsPages.length > 1) {
      menu[`-> (${this.currentPage + 1}/${this.projectsPages.length})`] =
        () => {
          this.currentPage++
          this.renderPage(1)
        }
      menu[`<- (${this.currentPage + 1}/${this.projectsPages.length})`] =
        () => {
          this.currentPage--
          this.renderPage(2)
        }
    }

    if (projects)
      for (const project of projects) {
        menu[project] = () => this.openProject(project)
      }

    select(menu, { defaultValue })
  }

  async renderNewProject(defaultName) {
    const name = defaultName || (await prompt('Project name'))['Project name']
    const menu = {}

    if (this.isProjectExists(name)) {
      console.clear()
      console.log(`Project ${format.green(name)} already exists`)
      select({
        'Run it': () => this.openProject(name),
        'Go back': () => this.renderPage(),
      })
      return
    }

    for (const templateName of Object.keys(this.config.templates)) {
      if (templateName.startsWith('_')) continue
      menu[templateName] = () => this.executeTemplate(templateName, name)
    }

    select(menu)
  }

  executeTemplate(template, name) {
    let steps = this.config.templates[template]
    if (!steps)
      return console.error(
        format.red(`There\'s no "${template}" template in config`)
      )
    if (!Array.isArray(steps)) steps = [steps]

    for (const step of steps) {
      const projectPath = path.resolve(this.config.path, name)
      let cmd = typeof step == 'string' ? step : step.cmd
      cmd = cmd.replace(/\$PROJECT_PATH/g, projectPath)
      cmd = cmd.replace(/\$NAME/g, name)
      childProcess.execSync(cmd, {
        stdio: template != '_OPEN_PROJECT' ? 'inherit' : undefined,
        cwd: step.cwd == 'project' ? projectPath : this.config.path,
      })
    }
    if (template != '_OPEN_PROJECT') this.openProject(name)
  }

  loadProjects() {
    this.allProjects = fs.readdirSync(this.config.path)

    this.projectsPages = []
    const { projectsPerPage } = this.config
    for (let i = 0; i < this.allProjects.length; i += projectsPerPage) {
      const page = this.allProjects.slice(i, i + projectsPerPage)
      this.projectsPages.push(page)
    }
  }

  initConfig() {
    if (!fs.existsSync('config.json'))
      fs.copyFileSync('default_config.json', 'config.json')

    this.config = require('./config.json')
    this.config.path = this.config.path.replace(/\$HOMEDIR/g, os.homedir())
    fs.ensureDirSync(this.config.path)
  }

  isProjectExists(projectName) {
    const projectPath = path.resolve(this.config.path, projectName)
    return fs.existsSync(projectPath)
  }

  processCliArg() {
    const lastArg = process.argv.splice(-1)[0]

    if (lastArg.startsWith('https')) {
      this.cloneRepo(lastArg)
    }

    if (!lastArg.includes('/') && !lastArg.includes('\\')) {
      if (this.isProjectExists(lastArg)) {
        this.openProject(lastArg)
        process.exit()
      } else {
        this.defaultRenderFunc = () => this.renderNewProject(lastArg)
      }
    }
  }

  cloneRepo(url) {
    childProcess.execSync('git clone ' + url, {
      stdio: 'inherit',
      cwd: this.config.path,
    })
  }

  openProject(name) {
    this.executeTemplate('_OPEN_PROJECT', name)
  }
}

new VSRunner()
