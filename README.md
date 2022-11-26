# vs-runner

## Configurable projects manager

![](docs/showcase.gif)

### Allows you to manage your projects and quickly create new ones based on customizable templates

## Features

- Customizable templates
- Quick open via win+r. You also can pass project name as argument to instantly open it
- Clone git repository by passing url as argument
- Page pagination

## Install

1. Clone Repository
2. With installed NodeJS execute `npm i`

### How to make it possible to open vs-runner via `Win+R`?

There's `vs.bat` file. You can type there directory of cloned vs-runner repository. By default it's `%userprofile%\Documents\Projects\vs-runner`

Now you should make `vs.bat` available in environment variables. For that you can add vs-runner folder into `PATH` env.var. or just copy `vs.bat` to already added folder in PATH. For example `C:\Windows\vs.bat`

## Config

You already have default config. If there's no `config.json` vs-runner will create new config based on it

### path

Path to your projects directory. May have `$HOMEDIR` variable that points to your home directory

### projectsPerPage

vs-runner splits projects into pages. You can choose how many to display projects on single page

### templates

Check default config for examples. Object that have template names as keys and commands to create project as value

For multiple commands you should pass them as array, but in case if it's only one you can pass only it without array

There's should be template `_OPEN_PROJECT` that describes how to open project

Command can have variables `$PROJECT_PATH` that equals to new project path and `$NAME` that equals to project name

Command can be a string or object that contains `cmd` as command. That way you also have:

- `cwd`: directory where command will be executed. The only possible value is `project` that says that command will be executed in new project directory. Otherwise it will be executed in the projects directory
