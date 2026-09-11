import { resolve } from 'node:path'
import * as prompts from '@clack/prompts'
import colors from 'picocolors'
import type { Config } from './config.ts'
import { isProjectDirectory, listProjects, projectNameIssue } from './projects.ts'
import { openProject, runTemplate } from './template-runner.ts'

const autocompleteChromeRows = 7

function wasCancelled(value: unknown): value is symbol {
  if (!prompts.isCancel(value)) return false

  prompts.cancel('Cancelled.')
  return true
}

function visibleOptionCount(optionCount: number): number {
  const availableRows = (process.stdout.rows ?? 24) - autocompleteChromeRows

  return Math.min(optionCount, Math.max(1, availableRows))
}

async function askProjectName(config: Config): Promise<string | undefined> {
  const name = await prompts.text({
    message: 'Project name',
    placeholder: 'my-project',
    validate: value => projectNameIssue(value ?? '', config.path),
  })

  return wasCancelled(name) ? undefined : name
}

export async function createProject(config: Config, suppliedName?: string): Promise<boolean> {
  const name = suppliedName ?? (await askProjectName(config))
  if (name === undefined) return false

  const issue = projectNameIssue(name, config.path)
  if (issue) throw new Error(issue)

  const projectPath = resolve(config.path, name)
  if (await isProjectDirectory(projectPath)) {
    const action = await prompts.select({
      message: `${colors.cyan(name)} already exists`,
      options: [
        { value: 'open', label: 'Open project' },
        { value: 'back', label: 'Go back' },
      ],
    })

    if (wasCancelled(action) || action === 'back') return false

    await openProject(config, name)
    prompts.outro(colors.green(`Opened ${name}.`))
    return true
  }

  const templateNames = Object.keys(config.templates)
  const templateName = await prompts.select({
    message: 'Project template',
    options: templateNames.map(name => ({ value: name, label: name })),
  })

  if (wasCancelled(templateName)) return false

  prompts.log.step(`Creating ${colors.cyan(name)} with ${templateName}`)
  await runTemplate(config, templateName, name)

  if (!(await isProjectDirectory(projectPath))) {
    throw new Error(`Template "${templateName}" finished without creating ${projectPath}.`)
  }

  prompts.log.success(`Created ${name}.`)
  await openProject(config, name)
  prompts.outro(colors.green(`Opened ${name}.`))
  return true
}

export async function showProjectMenu(config: Config): Promise<void> {
  while (true) {
    const projects = await listProjects(config.path)
    const options = [
      { value: 'create', label: colors.green('Create a new project') },
      ...projects.map((name, projectIndex) => ({
        value: `project:${projectIndex}`,
        label: name,
      })),
      { value: 'exit', label: colors.dim('Exit') },
    ]

    const action = await prompts.autocomplete({
      message: projects.length ? 'Find a project' : 'No projects yet',
      placeholder: 'Type to search',
      maxItems: visibleOptionCount(options.length),
      options,
    })

    if (wasCancelled(action) || action === 'exit') return

    if (action === 'create') {
      if (await createProject(config)) return

      continue
    }

    const projectIndex = Number(action.slice('project:'.length))
    const name = projects[projectIndex]
    if (!name) throw new Error('The selected project is no longer available.')

    await openProject(config, name)
    prompts.outro(colors.green(`Opened ${name}.`))
    return
  }
}
