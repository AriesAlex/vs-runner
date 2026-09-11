import { homedir } from 'node:os'
import { resolve } from 'node:path'

type CommandGroup = {
  run: string | string[]
  cwd?: string
}

type TemplateStep = string | CommandGroup
type Template = string | TemplateStep[]

export interface Config {
  path: string
  open: string
  templates: Record<string, Template>
}

const rootDirectory = resolve(import.meta.dir, '..')
const configPath = resolve(rootDirectory, 'config.yaml')
const defaultConfigPath = resolve(rootDirectory, 'default_config.yaml')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseCommand(value: unknown, location: string): string {
  if (typeof value === 'string' && value.trim()) return value

  throw new Error(`${location} must be a non-empty command string.`)
}

function parseStep(value: unknown, location: string): TemplateStep {
  if (typeof value === 'string') return parseCommand(value, location)

  if (!isRecord(value)) {
    throw new Error(`${location} must be a command string or a group with run and optional cwd.`)
  }

  const run = Array.isArray(value.run)
    ? value.run.map((command, commandIndex) => parseCommand(command, `${location}.run[${commandIndex}]`))
    : parseCommand(value.run, `${location}.run`)

  if (Array.isArray(run) && run.length === 0) {
    throw new Error(`${location}.run must contain at least one command.`)
  }

  if (value.cwd !== undefined && (typeof value.cwd !== 'string' || !value.cwd.trim())) {
    throw new Error(`${location}.cwd must be a non-empty path.`)
  }

  return value.cwd === undefined ? { run } : { run, cwd: value.cwd }
}

function parseTemplate(value: unknown, location: string): Template {
  if (typeof value === 'string') return parseCommand(value, location)

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${location} must be a command string or a non-empty step list.`)
  }

  return value.map((step, stepIndex) => parseStep(step, `${location}[${stepIndex}]`))
}

function parseConfig(value: unknown): Config {
  if (!isRecord(value)) throw new Error('config.yaml must contain a configuration object.')
  if (typeof value.path !== 'string' || !value.path.trim()) {
    throw new Error('config.yaml: path must be a non-empty string.')
  }

  const open = parseCommand(value.open, 'config.yaml: open')
  if (!isRecord(value.templates)) {
    throw new Error('config.yaml: templates must be a command object.')
  }

  const templates = Object.fromEntries(
    Object.entries(value.templates).map(([name, template]) => {
      if (!name.trim()) throw new Error('config.yaml: template names cannot be empty.')

      return [name, parseTemplate(template, `templates.${name}`)]
    }),
  )

  if (Object.keys(templates).length === 0) {
    throw new Error('config.yaml needs at least one template.')
  }

  return { path: value.path, open, templates }
}

export async function loadConfig(): Promise<Config> {
  const file = Bun.file(configPath)

  if (!(await file.exists())) {
    await Bun.write(file, Bun.file(defaultConfigPath))
  }

  const config = parseConfig(Bun.YAML.parse(await file.text()))

  return {
    ...config,
    path: resolve(rootDirectory, expandHome(config.path)),
  }
}

export function expandHome(path: string): string {
  if (path === '~') return homedir()

  return path.replace(/^~(?=[\\/])/u, () => homedir())
}
