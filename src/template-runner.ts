import { resolve } from 'node:path'
import { $ as shell } from 'bun'
import type { Config } from './config.ts'
import { expandHome } from './config.ts'

type TemplateContext = {
  name: string
  projectPath: string
  projectsPath: string
}

function interpolate(value: string, context: TemplateContext, escapeValue: (value: string) => string): string {
  return value.replace(/\$PROJECTS_PATH|\$PROJECT_PATH|\$NAME/gu, token => {
    if (token === '$NAME') return escapeValue(context.name)
    if (token === '$PROJECT_PATH') return escapeValue(context.projectPath)

    return escapeValue(context.projectsPath)
  })
}

export async function runTemplate(config: Config, templateName: string, name: string): Promise<void> {
  const template = config.templates[templateName]
  if (template === undefined) throw new Error(`Template "${templateName}" does not exist.`)

  const projectPath = resolve(config.path, name)
  const context = { name, projectPath, projectsPath: config.path }
  const steps = Array.isArray(template) ? template : [template]

  for (const step of steps) {
    const commands = typeof step === 'string' ? [step] : Array.isArray(step.run) ? step.run : [step.run]
    const configuredCwd = typeof step === 'string' ? undefined : step.cwd
    const renderedCwd =
      configuredCwd === undefined || configuredCwd === 'project'
        ? configuredCwd
        : interpolate(configuredCwd, context, String)
    const cwd = renderedCwd === 'project' ? projectPath : resolve(config.path, expandHome(renderedCwd ?? '.'))

    for (const command of commands) {
      const renderedCommand = interpolate(command, context, shell.escape)
      const result = await shell`${{ raw: renderedCommand }}`.cwd(cwd).nothrow()

      if (result.exitCode !== 0) {
        throw new Error(`Template "${templateName}" failed with exit code ${result.exitCode}.`)
      }
    }
  }
}

export async function openProject(config: Config, name: string): Promise<void> {
  const projectPath = resolve(config.path, name)
  const context = { name, projectPath, projectsPath: config.path }
  const renderedCommand = interpolate(config.open, context, shell.escape)
  const result = await shell`${{ raw: renderedCommand }}`.cwd(config.path).nothrow()

  if (result.exitCode !== 0) {
    throw new Error(`Open command failed with exit code ${result.exitCode}.`)
  }
}
