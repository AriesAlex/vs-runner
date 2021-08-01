let { select, prompt, format } = require('ariex-cli-wrapper')
let fs = require('fs-extra')
let path = require('path')
let childProcess = require('child_process')

if(!fs.existsSync('config.json')) fs.copyFileSync('default_config.json', 'config.json')
let config = require('./config.json')
fs.ensureDirSync(config.path)

let selector = {}

selector[format.green('New project..')] = async () => {
  let name = (await prompt('Project name'))['Project name']
  let dir = path.resolve(config.path, name)

  let presets = {}

  let types = Object.keys(config.projects)
  types.forEach(type => {
    let preset = config.projects[type]

    presets[type] = () => {
      preset.forEach(step => {
        let cmd = typeof step == 'string' ? step : step.cmd
        cmd = cmd.replace(/\$DIR/g, dir)
        cmd = cmd.replace(/\$NAME/g, name)
        childProcess.execSync(cmd, {stdio: 'inherit', cwd: step.cwd == 'project' ? dir : config.path})
      })
    }
  })

  select(presets)
}

fs.readdirSync(config.path).forEach(file => {
  selector[file] = () => {
    childProcess.execSync('code ' + path.resolve(config.path, file), {stdio: 'inherit'})
  }
})

select(selector)