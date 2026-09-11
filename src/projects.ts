import { readdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const projectNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function projectNameIssue(name: string, projectsPath: string): string | undefined {
  if (!name.trim()) return 'Project name is required.'
  if (name !== name.trim()) return 'Project name cannot start or end with whitespace.'
  if (name.startsWith('-')) return 'Project name cannot start with a dash.'
  if (dirname(resolve(projectsPath, name)) !== resolve(projectsPath)) {
    return 'Project name must be a single directory name.'
  }

  return undefined
}

export async function isProjectDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false

    throw error
  }
}

export async function listProjects(projectsPath: string): Promise<string[]> {
  const entries = await readdir(projectsPath, { withFileTypes: true })

  return entries
    .filter(entry => entry.isDirectory() || entry.isSymbolicLink())
    .map(entry => entry.name)
    .sort(projectNameCollator.compare)
}

export function isGitSource(value: string): boolean {
  if (/^[\w.-]+@[\w.-]+:.+/u.test(value)) return true
  if (!URL.canParse(value)) return false

  return ['git:', 'http:', 'https:', 'ssh:'].includes(new URL(value).protocol)
}

export async function cloneRepository(projectsPath: string, source: string): Promise<void> {
  const git = Bun.which('git', { cwd: projectsPath })
  if (!git) throw new Error('Git was not found in PATH.')

  const process = Bun.spawn([git, 'clone', '--', source], {
    cwd: projectsPath,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const exitCode = await process.exited

  if (exitCode !== 0) throw new Error(`git clone failed with exit code ${exitCode}.`)
}
