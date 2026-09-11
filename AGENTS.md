# vs-runner

This is a Windows-oriented project launcher built with Bun and strict TypeScript. `default_config.yaml` is the tracked default; the ignored `config.yaml` is each user's source of truth, and `vs-runner.schema.json` documents its contract for editors.

## Source map and code style

- Keep `src/main.ts` as the small CLI composition root. Configuration parsing belongs in `src/config.ts`, project discovery and Git operations in `src/projects.ts`, interactive flows in `src/prompts.ts`, and configured command execution in `src/template-runner.ts`.
- Let files and functions reflect stable responsibilities a person would look for in an IDE. Use descriptive domain names; do not use one-letter aliases, vague generic names, meaningless renames, or a new function that only hides one obvious line.
- Make code readable from top to bottom. Separate logical phases with blank lines and use comments only when they explain a non-obvious constraint or decision.
- Validate external configuration at its boundary, then trust the resulting types internally. Avoid speculative fallbacks, optional chaining, runtime checks, and compatibility branches that are not justified by real behavior.
- Use the local Oxc toolchain: Oxfmt owns formatting and import ordering; Oxlint owns linting, including TypeScript 7 type-aware rules through `oxlint-tsgolint`. Do not add Biome, ESLint, Prettier, `typescript-eslint`, or a parallel TypeScript 6 compatibility layer.

## Bun-first toolchain

- Bun 1.4 is this project's runtime, package manager, script runner, and direct TypeScript execution path. Run the CLI source directly during development; do not bundle it merely as a syntax or verification pass.
- Do not add Vite, Vite+, or another bundler to vs-runner itself without a concrete requirement Bun cannot satisfy. This does not restrict configured templates that intentionally scaffold projects using Vite or other frameworks.
- Add `bun build` or `bun build --compile` only for an actual release or deployment artifact. Decide the target, output, and compatibility requirements from that consumer rather than keeping an unused build pipeline.

## Contracts

- Keep the YAML format human-first: `open` is a root command, and a template is one Bun Shell command or a sequence of string/group steps. A group has `run: string | string[]` and optional `cwd`; do not split commands into argv arrays.
- Preserve `$NAME`, `$PROJECT_PATH`, and `$PROJECTS_PATH`; substitute them with Bun Shell escaping in commands and raw values in `cwd`. Expand a leading `~` in configured paths. Treat command text itself as trusted local configuration.
- Keep runtime validation, `default_config.yaml`, `vs-runner.schema.json`, and README examples aligned whenever the config contract changes.
- Use relevant Bun APIs directly (`Bun.file`, `Bun.write`, `Bun.YAML`, Bun Shell, `Bun.spawn`, `Bun.which`, and `Bun.argv`). Use `node:fs` directory APIs where Bun's own documentation recommends them. Do not reintroduce `fs-extra` or a child-process wrapper.
- Change scaffold defaults only after checking the current official generator CLI. Prefer Bun and TypeScript; Vue starters use Vite.

## Workflow and verification

- Prefer the cleanest strong result in the context of the whole codebase. Minimality means no unnecessary code, state, abstraction, or wrong ownership layer—not the fewest changed lines.
- Inspect the real implementation and config flow before changing behavior. Keep one source of truth for each contract and avoid speculative fallbacks or compatibility layers.
- Run `bun install` after dependency changes and commit `bun.lock`; do not recreate `package-lock.json`.
- Use `bun run format` for formatting, `bun run lint` for type-aware linting, `bun run typecheck` for the strict TypeScript 7 compiler, and `bun run fix` for safe automated fixes. Run `bun run check` after code or config changes. Smoke-check `bun src/main.ts --help` and `bun src/main.ts --version` when CLI parsing changes.
- Preserve unrelated dirty work. Keep temporary files and generated research artifacts outside the repository.
- After completing and verifying a user-requested change, commit its task-scoped diff and push the current branch to `origin` without waiting for a separate request. Skip this only when the user explicitly asks not to commit or push, or when delivery is blocked; never include unrelated work.
- This GitHub repository is public. Never commit or push secrets, and never print secret values in logs, diffs, answers, issues, pull requests, or comments.

Если пользователь в ходе работы даёт новые устойчивые правила по стилю кода, структуре или процессу, то их надо кратко и по делу сразу добавлять в этот файл `AGENTS.md`, если это реально полезно будущим агентам.

Правила в `AGENTS.md` добавлять только если пользователь явно просит сохранить что-то универсальное и долговременное; не заносить туда ситуативные договорённости текущей задачи.

«"Работает" недостаточно. После того как довел до рабочего состояния, убедись, что решение встроено в код красиво и без временных подпорок. Если по пути пришлось оставить костыль или фоллбэк, потом обязательно добейся его удаления, даже если для этого надо явно попросить пользователя сделать связанное изменение.»
