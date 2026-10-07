# Deploy targets — `deploy.sh <command> [dev|prod]`

**Date:** 2026-10-06 16:40
**Status:** done
**Scope:** `deploy/` (`deploy.sh`, `.env.example`, `.env` → `.env.dev`), `.gitignore`,
`.github/workflows/deploy.yml`, `scripts/ssh/_remove-ssh-passphrase.sh`, four `docs/Specs/` files,
a new offline test.
**History entry:** `docs/history/2026-10-06--16-40-00-deploy-env-selection.md`
**Plan:** `docs/history/2026-10-06-deploy-env-selection-plan.md`

## 1. Problem / feature

One `deploy/.env` could hold only one `HOST`, so a dev and a prod droplet could not coexist: switching
targets meant hand-editing the operator config. The requested shape was a target argument —

```
deploy.sh <command> [dev|prod] [--verbose]      # dev is the default; .env becomes .env.dev
```

## 2. Measured data / evidence

| Check | Observation |
|---|---|
| `git check-ignore -v deploy/.env.dev` (before) | **no match** — only the bare `.env` was ignored, so a per-env deploy file with the droplet address and SSH key path was *committable* |
| `.github/workflows/deploy.yml` `exclude:` list | hardcoded `deploy/.env` only; `deploy.yml` **mirrors** `deploy.sh` instead of calling it |
| consumers of `deploy/.env` | `deploy.sh` (source + scp), `scripts/ssh/_remove-ssh-passphrase.sh` (greps `SSH_KEY=`), `scripts/ssh/README.md` |
| `deploy.sh` env selection (before) | `APP_ENV` environment variable, default `dev`, no argument |
| first offline run of the new suite | 14 pass / 4 fail — two expectation mismatches, one **real** bug (below), one test-harness artefact |

**Real bug found during implementation:** argument parsing `shift`s the positional parameters, but the
command `case` still read `"${1:-}"` — i.e. the *target*. Every command fell into the
unknown-command branch (`unknown command 'ps'`). The offline suite missed it (all its scenarios abort
before the dispatch); a direct probe caught it.

## 3. Root cause or design rationale

The per-environment split existed for application config (`apps/**`, `infra/**`) but not for the
**operator** config, because `deploy/.env` was assumed to be a single-machine file. With two droplets
that assumption breaks. Decisions taken (approved up front):

| # | Decision | Rationale |
|---|---|---|
| D1 | Legacy `deploy/.env` is **not** a fallback; the script detects it and prints `mv deploy/.env deploy/.env.dev` | a silent fallback can deploy to the wrong droplet |
| D2 | positional argument **>** `APP_ENV` env var **>** default `dev`, warning on conflict | what you name on the command line is what you get; `APP_ENV=prod deploy.sh up` keeps working |
| D3 | `deploy/.env.prod` is created only when the prod droplet exists | an empty-but-present file just moves the error |
| D4 | bad target → **exit 2** | distinguishes "typed it wrong" from "deploy failed" |
| D5 | one committed `deploy/.env.example` template (no per-env templates) | matches the existing `apps/*/.env.example` + gitignored `.env.<target>` convention |
| D6 | `_remove-ssh-passphrase.sh` takes an optional target, default `dev` | consistent with `deploy.sh` |

`local` is deliberately rejected as a target: `deploy.sh` never deploys to a local droplet —
`scripts/dev-stack.sh` does, using `infra/.env.local`.

## 4. Solution / implementation

| File | Change |
|---|---|
| `deploy/deploy.sh` | target parsed **before** any file is sourced (the target decides *which* file); validated after `deploy_log_init` so a rejected target is still logged; `APP_ENV` set from the target and re-asserted after sourcing (single source of truth for `infra/.env.${APP_ENV}`, the SPA build mode and the compose `--env-file`); `HOST` guard + usage text name the selected file; rsync excludes the per-env deploy files; scp ships the **selected** file (droplet destination stays `deploy/.env`); dispatch reads `DEPLOY_CMD`; the target is part of the log file name |
| `deploy/.env.example` | header documents the per-target copy contract |
| `.gitignore` | `deploy/.env.{local,dev,prod}` |
| `.github/workflows/deploy.yml` | the same three files added to the upload `exclude:` list (otherwise CI uploads the operator's droplet address + key path) |
| `scripts/ssh/_remove-ssh-passphrase.sh` | optional target, resolves `deploy/.env.<target>`, migration hint |
| docs/specs | `deploy/README.md` (+ target callout, §10 naming), `deploy/deploy.ps1` help, Production-Runbook (new target section, examples, sample error), Local-Development, Three-Env-Verification, Caddy-Reverse-Proxy |
| `scripts/test/_deploy-sh-env-selection-test.sh` | new offline suite: 11 scenarios / 29 assertions, driven through a sandbox copy of `deploy/` so the real env files are never touched |

## 5. Outcome and how to verify

```
bash scripts/test/_deploy-sh-env-selection-test.sh   # 29 passed, 0 failed
bash scripts/test/_deploy-sh-m1-test.sh              # ALL_OK (7/7)
bash scripts/test/_deploy-sh-logger-test.sh          # 10 passed, 0 failed

bash deploy/deploy.sh ps            # loads deploy/.env.dev (default), config: line names it
bash deploy/deploy.sh ps prod       # exit 1: environment file not found: deploy/.env.prod
bash deploy/deploy.sh up staging    # exit 2: invalid environment 'staging' — valid values: dev, prod
bash deploy/deploy.sh help          # exit 0, usage documents [dev|prod]
git check-ignore -v deploy/.env.dev # .gitignore:69  (ignored)
powershell -File deploy\deploy.ps1 ps prod
```

## 6. Follow-ups

* `prod` is wired but untested end to end: no prod droplet, no `deploy/.env.prod`, no
  `DROPLET_HOST_PROD` secret. The CI half is documented in `deploy/README.md`.
* A bare `bash` on Windows can resolve to the Microsoft Store **WSL stub** before `/usr/bin/bash`
  when the Windows PATH is inherited; the new test pins its own interpreter for this reason. Worth
  remembering for any future script that shells out to `bash`.
* `scripts/test/_deploy-sh-m3-test.sh` is still red for a pre-existing, unrelated reason
  (`infra/.env` is gitignored and absent from a fresh checkout).
