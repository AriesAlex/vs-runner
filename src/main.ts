#!/usr/bin/env bun

import * as p from "@clack/prompts";
import { $ } from "bun";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { mkdir, readdir, stat } from "node:fs/promises";
import { parseArgs } from "node:util";
import pc from "picocolors";
import packageJson from "../package.json" with { type: "json" };

type CommandGroup = {
  run: string | string[];
  cwd?: string;
};

type TemplateStep = string | CommandGroup;
type Template = string | TemplateStep[];

interface Config {
  path: string;
  open: string;
  templates: Record<string, Template>;
}

const rootDirectory = resolve(import.meta.dir, "..");
const configPath = resolve(rootDirectory, "config.yaml");
const defaultConfigPath = resolve(rootDirectory, "default_config.yaml");
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  location: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new Error(`${location} has unknown field "${unknown[0]}".`);
}

function parseCommand(value: unknown, location: string): string {
  if (typeof value === "string" && value.trim()) return value;
  throw new Error(`${location} must be a non-empty command string.`);
}

function parseStep(value: unknown, location: string): TemplateStep {
  if (typeof value === "string") return parseCommand(value, location);

  if (!isRecord(value)) {
    throw new Error(`${location} must be a command string or a group with run and optional cwd.`);
  }
  assertOnlyKeys(value, ["run", "cwd"], location);

  const run = Array.isArray(value.run)
    ? value.run.map((command, index) => parseCommand(command, `${location}.run[${index}]`))
    : parseCommand(value.run, `${location}.run`);
  if (Array.isArray(run) && run.length === 0) {
    throw new Error(`${location}.run must contain at least one command.`);
  }
  if (value.cwd !== undefined && (typeof value.cwd !== "string" || !value.cwd.trim())) {
    throw new Error(`${location}.cwd must be a non-empty path.`);
  }

  return value.cwd === undefined ? { run } : { run, cwd: value.cwd };
}

function parseTemplate(value: unknown, location: string): Template {
  if (typeof value === "string") return parseCommand(value, location);
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${location} must be a command string or a non-empty step list.`);
  }
  return value.map((step, index) => parseStep(step, `${location}[${index}]`));
}

function parseConfig(value: unknown): Config {
  const source = "config.yaml";
  if (!isRecord(value)) throw new Error(`${source} must contain a configuration object.`);
  assertOnlyKeys(value, ["path", "open", "templates"], source);
  if (typeof value.path !== "string" || !value.path.trim()) {
    throw new Error(`${source}: path must be a non-empty string.`);
  }
  const open = parseCommand(value.open, `${source}: open`);
  if (!isRecord(value.templates)) {
    throw new Error(`${source}: templates must be a command object.`);
  }

  const templates = Object.fromEntries(
    Object.entries(value.templates).map(([name, template]) => {
      if (!name.trim()) throw new Error(`${source}: template names cannot be empty.`);
      return [name, parseTemplate(template, `templates.${name}`)];
    }),
  );

  if (Object.keys(templates).length === 0) throw new Error(`${source} needs at least one template.`);

  return {
    path: value.path,
    open,
    templates,
  };
}

async function loadConfig(): Promise<Config> {
  const file = Bun.file(configPath);

  if (!(await file.exists())) {
    await Bun.write(file, Bun.file(defaultConfigPath));
  }

  const config = parseConfig(Bun.YAML.parse(await Bun.file(configPath).text()));

  return {
    ...config,
    path: resolve(rootDirectory, expandHome(config.path)),
  };
}

function expandHome(path: string): string {
  if (path === "~") return homedir();
  return path.replace(/^~(?=[\\/])/u, () => homedir());
}

function interpolate(
  value: string,
  name: string,
  projectPath: string,
  projectsPath: string,
  escape: (value: string) => string,
): string {
  const tokens: Record<string, string> = {
    "$NAME": name,
    "$PROJECT_PATH": projectPath,
    "$PROJECTS_PATH": projectsPath,
  };
  return value.replace(/\$PROJECTS_PATH|\$PROJECT_PATH|\$NAME/gu, (token) => escape(tokens[token]!));
}

function projectNameIssue(name: string, projectsPath: string): string | undefined {
  if (!name.trim()) return "Project name is required.";
  if (name !== name.trim()) return "Project name cannot start or end with whitespace.";
  if (name.startsWith("-")) return "Project name cannot start with a dash.";
  if (dirname(resolve(projectsPath, name)) !== resolve(projectsPath)) {
    return "Project name must be a single directory name.";
  }

  if (process.platform === "win32") {
    if (/[<>:"/\\|?*\u0000-\u001F]/u.test(name) || /[. ]$/u.test(name)) {
      return "Project name contains characters that Windows does not allow.";
    }
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(name)) {
      return "Project name is reserved by Windows.";
    }
  }

  return undefined;
}

async function isProjectDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

async function listProjects(projectsPath: string): Promise<string[]> {
  const entries = await readdir(projectsPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort(collator.compare);
}

async function runTemplate(
  config: Config,
  templateName: string,
  name: string,
): Promise<void> {
  const template = config.templates[templateName];
  if (template === undefined) throw new Error(`Template "${templateName}" does not exist.`);

  const projectPath = resolve(config.path, name);
  const steps = Array.isArray(template) ? template : [template];

  for (const step of steps) {
    const commands = typeof step === "string"
      ? [step]
      : Array.isArray(step.run) ? step.run : [step.run];
    const configuredCwd = typeof step === "string" ? undefined : step.cwd;
    const interpolatedCwd = configuredCwd === undefined || configuredCwd === "project"
      ? configuredCwd
      : interpolate(configuredCwd, name, projectPath, config.path, String);
    const cwd = configuredCwd === "project"
      ? projectPath
      : resolve(config.path, expandHome(interpolatedCwd ?? "."));

    for (const command of commands) {
      const rendered = interpolate(command, name, projectPath, config.path, $.escape);
      const result = await $`${{ raw: rendered }}`.cwd(cwd).nothrow();

      if (result.exitCode !== 0) {
        throw new Error(`Template "${templateName}" failed with exit code ${result.exitCode}.`);
      }
    }
  }
}

async function openProject(config: Config, name: string): Promise<void> {
  const projectPath = resolve(config.path, name);
  const rendered = interpolate(config.open, name, projectPath, config.path, $.escape);
  const result = await $`${{ raw: rendered }}`.cwd(config.path).nothrow();
  if (result.exitCode !== 0) {
    throw new Error(`Open command failed with exit code ${result.exitCode}.`);
  }
}

function isGitSource(value: string): boolean {
  if (/^[\w.-]+@[\w.-]+:.+/u.test(value)) return true;
  if (!URL.canParse(value)) return false;
  return ["git:", "http:", "https:", "ssh:"].includes(new URL(value).protocol);
}

async function cloneRepository(config: Config, source: string): Promise<void> {
  const git = Bun.which("git", { cwd: config.path });
  if (!git) throw new Error("Git was not found in PATH.");

  p.log.step("Cloning repository");
  const process = Bun.spawn([git, "clone", "--", source], {
    cwd: config.path,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await process.exited;
  if (exitCode !== 0) throw new Error(`git clone failed with exit code ${exitCode}.`);
  p.outro(pc.green("Repository cloned."));
}

function cancelled(value: unknown): value is symbol {
  if (!p.isCancel(value)) return false;
  p.cancel("Cancelled.");
  return true;
}

async function askProjectName(config: Config): Promise<string | undefined> {
  const name = await p.text({
    message: "Project name",
    placeholder: "my-project",
    validate: (value) => projectNameIssue(value ?? "", config.path),
  });
  return cancelled(name) ? undefined : name;
}

async function createProject(config: Config, suppliedName?: string): Promise<boolean> {
  const name = suppliedName ?? await askProjectName(config);
  if (!name) return false;

  const issue = projectNameIssue(name, config.path);
  if (issue) throw new Error(issue);

  const projectPath = resolve(config.path, name);
  if (await isProjectDirectory(projectPath)) {
    const action = await p.select({
      message: `${pc.cyan(name)} already exists`,
      options: [
        { value: "open", label: "Open project" },
        { value: "back", label: "Go back" },
      ],
    });
    if (cancelled(action) || action === "back") return false;
    await openProject(config, name);
    p.outro(pc.green(`Opened ${name}.`));
    return true;
  }

  const templateNames = Object.keys(config.templates);
  const templateName = await p.select({
    message: "Project template",
    options: templateNames.map((template) => ({ value: template, label: template })),
  });
  if (cancelled(templateName)) return false;

  p.log.step(`Creating ${pc.cyan(name)} with ${templateName}`);
  await runTemplate(config, templateName, name);

  if (!(await isProjectDirectory(projectPath))) {
    throw new Error(`Template "${templateName}" finished without creating ${projectPath}.`);
  }

  p.log.success(`Created ${name}.`);
  await openProject(config, name);
  p.outro(pc.green(`Opened ${name}.`));
  return true;
}

async function showProjectMenu(config: Config): Promise<void> {
  while (true) {
    const projects = await listProjects(config.path);
    const options = [
      { value: "create", label: pc.green("Create a new project") },
      ...projects.map((name, index) => ({
        value: `project:${index}`,
        label: name,
      })),
      { value: "exit", label: pc.dim("Exit") },
    ];

    const action = await p.autocomplete({
      message: projects.length ? "Find a project" : "No projects yet",
      placeholder: "Type to search",
      maxItems: 10,
      options,
    });
    if (cancelled(action) || action === "exit") return;

    if (action === "create") {
      if (await createProject(config)) return;
      continue;
    }
    const index = Number(action.slice("project:".length));
    const name = projects[index];
    if (!name) throw new Error("The selected project is no longer available.");
    await openProject(config, name);
    p.outro(pc.green(`Opened ${name}.`));
    return;
  }
}

function printHelp(): void {
  console.log(`vs-runner ${packageJson.version}

Usage:
  vs [project-name | git-url]

Options:
  -h, --help       Show this help
  -v, --version    Show the version

With no argument, vs-runner opens the interactive project menu.`);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) return printHelp();
  if (values.version) return console.log(packageJson.version);
  if (positionals.length > 1) throw new Error("Expected at most one project name or Git URL.");

  p.intro(pc.bgCyan(pc.black(" vs-runner ")));
  const config = await loadConfig();
  await mkdir(config.path, { recursive: true });

  const target = positionals[0];
  if (!target) return showProjectMenu(config);
  if (isGitSource(target)) return cloneRepository(config, target);

  const issue = projectNameIssue(target, config.path);
  if (issue) throw new Error(issue);

  if (await isProjectDirectory(resolve(config.path, target))) {
    await openProject(config, target);
    p.outro(pc.green(`Opened ${target}.`));
    return;
  }

  await createProject(config, target);
}

try {
  await main();
} catch (error) {
  p.log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
