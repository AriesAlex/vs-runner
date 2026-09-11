#!/usr/bin/env bun

import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import * as prompts from '@clack/prompts'
import colors from 'picocolors'
import packageJson from '../package.json' with { type: 'json' }
import { loadConfig } from './config.ts'
import { cloneRepository, isGitSource, isProjectDirectory, projectNameIssue } from './projects.ts'
import { createProject, showProjectMenu } from './prompts.ts'
import { openProject } from './template-runner.ts'

function printHelp(): void {
  console.log(`vs-runner ${packageJson.version}

Usage:
  vs [project-name | git-url]

Options:
  -h, --help       Show this help
  -v, --version    Show the version

With no argument, vs-runner opens the interactive project menu.`)
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
    allowPositionals: true,
    strict: true,
  })

  if (values.help) return printHelp()
  if (values.version) return console.log(packageJson.version)
  if (positionals.length > 1) throw new Error('Expected at most one project name or Git URL.')

  prompts.intro(colors.bgCyan(colors.black(' vs-runner ')))

  const config = await loadConfig()
  await mkdir(config.path, { recursive: true })

  const target = positionals[0]
  if (!target) return showProjectMenu(config)

  if (isGitSource(target)) {
    prompts.log.step('Cloning repository')
    await cloneRepository(config.path, target)
    prompts.outro(colors.green('Repository cloned.'))
    return
  }

  const issue = projectNameIssue(target, config.path)
  if (issue) throw new Error(issue)

  if (await isProjectDirectory(resolve(config.path, target))) {
    await openProject(config, target)
    prompts.outro(colors.green(`Opened ${target}.`))
    return
  }

  await createProject(config, target)
}

try {
  await main()
} catch (error) {
  prompts.log.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
