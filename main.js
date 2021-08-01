let { select, prompt, format } = require('ariex-cli-wrapper')
let fs = require('fs-extra')
let path = require('path')
let childProcess = require('child_process')

if(!fs.existsSync('config.json')) fs.copyFileSync('default_config.json', 'config.json')
let config = require('./config.json')
fs.ensureDirSync(config.path)

let selector = {}

selector[format.green('Новый проект..')] = async () => {
  let name = (await prompt('Название'))['Название']
  let dir = path.resolve(config.path, name)

  select({
    NodeJS: () => {
      fs.mkdirSync(dir)
      childProcess.execSync('echo //TODO>main.js', {cwd: dir, stdio: 'inherit'})
      childProcess.execSync('npm init -y', {cwd: dir, stdio: 'inherit'})
      childProcess.execSync('code ' + dir, {stdio: 'inherit'})
    },
    Vue: () => {
      childProcess.execSync('vue create -p ArieX ' + name, {cwd: config.path, stdio: 'inherit'})
      childProcess.execSync('code ' + dir, {stdio: 'inherit'})
    },
    'Vue+Electron': () => {
      childProcess.execSync('vue create -p ArieX ' + name, {cwd: config.path, stdio: 'inherit'})
      childProcess.execSync('vue add electron-builder', {cwd: dir, stdio: 'inherit'})
      childProcess.execSync('code ' + dir)
    },
    Flutter: () => {
      childProcess.execSync('flutter create ' + name, {cwd: config.path, stdio: 'inherit'})
      childProcess.execSync('code ' + dir, {stdio: 'inherit'})
    }
  })
}

fs.readdirSync(config.path).forEach(file => {
  selector[file] = () => {
    childProcess.execSync('code ' + path.resolve(config.path, file), {stdio: 'inherit'})
  }
})

select(selector)