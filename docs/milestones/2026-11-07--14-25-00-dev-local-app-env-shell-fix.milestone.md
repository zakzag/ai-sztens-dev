# Milestone — `pnpm dev:local` and the shell that runs `package.json` scripts (2026-11-07)

**Scope:** root `package.json`, `run_local_dev.ps1`, `docs/Specs/Local-Development.md`, `docs/Specs/Database-Local.md`, `README.md`.

## 1. Problem

`pnpm dev:local` was supposed to start the whole dev stack with `APP_ENV=local` (so NestJS reads
`apps/api/.env.local` and the localhost CORS list). It did not: the command failed or started the API
in `dev` mode, and the admin SPA was rejected by CORS.

## 2. Measured data / evidence

| Check | Result |
| ----- | ------ |
| Old body | `"dev:local": "$env:APP_ENV='local'; pnpm dev"` |
| `pnpm config get script-shell` | `undefined` → platform default shell (`cmd.exe` / `/bin/sh`) |
| Same body run in the default shell | `The filename, directory name, or volume label syntax is incorrect.` (cmd rejects the `:` in `$env:APP_ENV`) |
| `cross-env` in the lockfile | absent |
| API banner without `APP_ENV` | `APP_ENV=dev (raw=(unset, defaulted to dev)) … CORS origins: https://web.aisztens.hu,…` |

## 3. Root cause / design rationale

npm/pnpm run scripts through the **operating system shell**, never through PowerShell. The body was
PowerShell syntax, so on Windows it aborted before `pnpm dev` started and `APP_ENV` never reached the
child processes; under `/bin/sh` the same line is `$env:APP_ENV=local: not found`. The script was
broken everywhere, and the "type the export into PowerShell first" habit masked it.

Ruled out during the investigation: `predev` not running for `dev:local` (the nested `pnpm dev` runs
it), `concurrently` stripping the environment (it inherits it), a missing `cross-env` (true, hence the
fix), and `normaliseAppEnv()`'s `dev` fallback (a *consequence*, and changing that fallback is
deploy-adjacent — a container without `APP_ENV` would then serve localhost CORS — so it stays `dev`).

Alternatives considered:

- **Change the `dev` script** to set `APP_ENV=local` — rejected: `pnpm dev` must stay the generic,
  environment-agnostic entry point (CI and the container flows depend on that meaning).
- **A Node launcher script** (`scripts/dev-local.mjs` spawning `pnpm dev`) — dependency-free and
  testable, but 30+ lines for what a one-line prefix does; kept as a fallback if `cross-env` ever
  becomes undesirable.
- **Duplicate per-platform scripts** (`set "APP_ENV=local" &&` vs `APP_ENV=local`) — impossible to
  dispatch without already knowing the shell.

## 4. Solution / implementation

| File | Change |
| ---- | ------ |
| `package.json` | `cross-env@10.1.0` added to root devDependencies; `"dev:local": "cross-env APP_ENV=local pnpm dev"` |
| `pnpm-lock.yaml` | regenerated with the repo's pinned pnpm 12 (the local 9.x CLI refuses the v11 store layout) |
| `run_local_dev.ps1` | delegates to `pnpm dev:local` instead of duplicating the export |
| `docs/Specs/Local-Development.md` | §5 + §6.6 recommend `pnpm dev:local`, explain the shell rule, header date |
| `docs/Specs/Database-Local.md` | CORS symptom row points at `pnpm dev:local`, header date |
| `README.md` | quick start + script table gained `pnpm dev:local` |

## 5. Outcome and how to verify

```bash
pnpm exec cross-env APP_ENV=local node -p "process.env.APP_ENV"              # local
pnpm exec cross-env APP_ENV=local pnpm exec node -p "process.env.APP_ENV"   # local (nested pnpm)
pnpm dev:local
# expect: [api] [Bootstrap] API up — APP_ENV=local (raw=local), listening on 0.0.0.0:3000,
#         CORS origins: http://localhost:5173,http://localhost:5174,...
```

A `dev` label in that banner still means the variable never arrived — that line is the fastest check.

## 6. Follow-ups

- `pnpm dev` intentionally keeps no `APP_ENV`; the docs and the banner remain the guard against
  running the local stack in `dev` mode.
- The local `pnpm` CLI is 9.15.4 while `packageManager` pins 12.16.1 and the store is on the v11
  layout; adding a dependency therefore needs `npx pnpm@12.16.1 …` until the global pnpm is upgraded.
