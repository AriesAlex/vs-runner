# vs-runner

A fast, configurable project launcher for Windows, powered by Bun and TypeScript.

## Features

- polished interactive UI with project search;
- open a project immediately with `vs project-name`;
- clone HTTPS, SSH, or Git remotes with `vs https://…`;
- compact YAML templates executed by the cross-platform Bun Shell;
- current starters for Vite, Vue, React, SvelteKit, Nuxt, NestJS, Expo, Tauri, AdonisJS, Electron Forge, Laravel, and Flutter.

## Install

Requirements: [Bun](https://bun.com/) 1.4.2 or newer, Git, and the editor command configured in `config.yaml` (`code` by default). Individual templates may require their own SDK or CLI.

```powershell
git clone https://github.com/AriesAlex/vs-runner.git
cd vs-runner
bun install
bun link
```

`bun link` exposes both `vs` and `vs-runner`. Bun's global bin directory must be in `PATH`; the Bun installer normally configures it. You can then enter `vs` in `Win+R` or a terminal.

For a one-off run without linking:

```powershell
bun run dev
bun src/main.ts my-project
```

## Config

The first run copies `default_config.yaml` to the ignored local `config.yaml`.

```yaml
# yaml-language-server: $schema=./vs-runner.schema.json

path: ~/Documents/Projects
open: code $PROJECT_PATH

templates:
  Vue + TypeScript:
    - bun create vite $NAME --template vue-ts --no-interactive
    - cwd: project
      run: bun install
```

The leading `~` in a configured path expands to your home directory. Commands and `cwd` support `$NAME`, `$PROJECT_PATH`, and `$PROJECTS_PATH`; command substitutions are shell-escaped before execution.

A template is normally one command string. Use a YAML list for sequential steps. A grouped step can share its working directory across one or more commands:

```yaml
templates:
  Custom app:
    - mkdir $PROJECT_PATH
    - cwd: project
      run:
        - bun init --yes
        - bun run prepare
```

`cwd: project` is shorthand for `$PROJECT_PATH`; any other relative `cwd` starts at `$PROJECTS_PATH`. Commands are trusted local configuration and may use Bun Shell features such as pipes, redirects, globs, and environment variables.

The schema directive in the default config enables structure validation, field descriptions, and completion in VS Code with a YAML extension. Available tokens are documented on command fields; completion inside an otherwise arbitrary shell string intentionally stays out of scope.

## Development

```powershell
bun run format
bun run lint
bun run typecheck
bun run check
bun run fix
```

Oxfmt and Oxlint are local development dependencies invoked through Bun scripts. `check` verifies formatting, runs
Oxlint with TypeScript 7 type information, and performs the strict TypeScript check. `fix` applies safe lint fixes and
then formats the supported files.

The CLI runs directly from TypeScript during development and installation. It is not bundled as part of routine
verification; add a Bun build or standalone executable only when a release artifact has a real consumer.
