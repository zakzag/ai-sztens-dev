# 2026-11-07 14:25 — `pnpm dev:local` never set `APP_ENV` (PowerShell syntax in a shell-run script)

**Scope:** root [`package.json`](../../package.json:20), [`run_local_dev.ps1`](../../run_local_dev.ps1:1), docs.
**Symptom:** `pnpm dev:local` did not start a local-env stack; the API kept booting with the `dev`
fallback (droplet CORS list, `apps/api/.env.dev` read first).

## Evidence

| Check | Result |
| ----- | ------ |
| Script body before the fix | `"dev:local": "$env:APP_ENV='local'; pnpm dev"` |
| `pnpm config get script-shell` | `undefined` → the platform default shell runs scripts (`cmd.exe` on Windows, `/bin/sh` elsewhere) |
| Running that body in the default shell | `The filename, directory name, or volume label syntax is incorrect.` — cmd rejects the `:` inside `$env:APP_ENV`, so nothing after it runs |
| `cross-env` in `pnpm-lock.yaml` | absent (no shell-neutral way to prefix a variable existed) |
| `predev` | **not** a defect: the nested `pnpm dev` runs its own `predev` hook |
| `concurrently` | **not** a defect: it inherits and forwards the parent environment |

## Root cause

`package.json` scripts are executed by the OS shell, never by PowerShell. `$env:NAME='value'` is
PowerShell-only, so on Windows the line died before `pnpm dev` ran, and `APP_ENV` was never exported
to the child processes. The same body is equally invalid under `/bin/sh` (`$env:APP_ENV=local: not
found`), so the script was broken on **every** platform, not just Windows — which is why the
workaround "type it into PowerShell yourself" still worked and hid the defect.

Consequence: NestJS's `normaliseAppEnv()` fell back to `dev`, `envFilePath` became
`['.env.dev', '.env.local']`, and the API served the **droplet** CORS origins — the documented trap in
[`Local-Development.md`](../Specs/Local-Development.md:315).

## Fix

- Added `cross-env@10.1.0` as a root devDependency (installed with the repo's pinned pnpm 12, because
  the local `pnpm` is 9.x and refuses the existing store layout).
- `"dev:local": "cross-env APP_ENV=local pnpm dev"` — shell-neutral, works in cmd, PowerShell and bash.
- `pnpm dev` is unchanged on purpose: it stays the environment-agnostic entry point.
- [`run_local_dev.ps1`](../../run_local_dev.ps1:1) now just calls `pnpm dev:local`, so the wiring
  exists in exactly one place.

## Verification

```bash
pnpm exec cross-env APP_ENV=local node -p "process.env.APP_ENV"                  # → local
pnpm exec cross-env APP_ENV=local pnpm exec node -p "process.env.APP_ENV"       # → local (nested pnpm keeps it)
pnpm dev:local    # boot banner must read: APP_ENV=local (raw=local) … CORS origins: http://localhost:5173,…
```

## Docs

- [`docs/Specs/Local-Development.md`](../Specs/Local-Development.md:1) — §5 pitfall and §6.6 now start
  the flow with `pnpm dev:local` and explain why the PowerShell body cannot live in `package.json`;
  header date refreshed.
- [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md:1) — the CORS symptom row points at
  `pnpm dev:local`; header date refreshed.
- [`README.md`](../../README.md:69) — quick start and the script table gained `pnpm dev:local`.
