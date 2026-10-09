# Deploy target argument — `deploy.sh <command> [dev|prod]`

**Date:** 2026-10-06 16:40
**Status:** done
**Scope:** [`deploy/deploy.sh`](../../deploy/deploy.sh), [`deploy/.env.example`](../../deploy/.env.example), `deploy/.env` → `deploy/.env.dev`,
[`.gitignore`](../../.gitignore), [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml),
[`scripts/ssh/_remove-ssh-passphrase.sh`](../../scripts/ssh/_remove-ssh-passphrase.sh), [`scripts/ssh/README.md`](../../scripts/ssh/README.md),
[`deploy/README.md`](../../deploy/README.md), [`deploy/deploy.ps1`](../../deploy/deploy.ps1),
[`scripts/test/_deploy-sh-env-selection-test.sh`](../../scripts/test/_deploy-sh-env-selection-test.sh) (new), four `docs/Specs/` files.
**Related:** [plan](2026-10-06-deploy-env-selection-plan.md),
[milestone](../milestones/2026-10-06--16-40-00-deploy-env-selection.milestone.md),
[three-env separation plan](2026-10-05--10-30-00-three-env-separation-plan.md)

---

## 1. Request

> "I want `deploy.sh` to have a parameter after the operation (`up`, `down`, `ps`, …) that says where
> to deploy: `dev` or `prod` — these two acceptable. `deploy.sh` picks `.env.dev` or `.env.prod` when
> given, otherwise `.env.dev` is the default. `.env` becomes `.env.dev`."

The plan ([`docs/history/2026-10-06-deploy-env-selection-plan.md`](2026-10-06-deploy-env-selection-plan.md))
was written first, reviewed, and approved with all six recommendations (D1–D6) as listed.

## 2. Behaviour now

```bash
./deploy/deploy.sh up            # deploy/.env.dev   (default target)
./deploy/deploy.sh up dev        # deploy/.env.dev
./deploy/deploy.sh up prod       # deploy/.env.prod
./deploy/deploy.sh ps dev --verbose
./deploy/deploy.sh up staging    # usage error, exit 2, valid values listed
./deploy/deploy.sh up local      # usage error, exit 2, explained (not a deploy target)
```

Precedence: **argument > `APP_ENV` environment variable > built-in `dev`**; a conflicting `APP_ENV`
is overridden with a warning. The resolved target is exported as `APP_ENV`, so `infra/.env.<target>`,
the SPA build mode and the compose `--env-file` cannot drift from the targeted droplet.

## 3. Files changed

| File | Change |
|---|---|
| [`deploy/deploy.sh`](../../deploy/deploy.sh) | argument parser (command / target / `--verbose` in any order); env-file validation + sourcing *before* the first guard; `APP_ENV` from the target, re-asserted after sourcing; `config:` log line now records `DEPLOY_ENV` and `env_file`; `HOST` guard and usage text name the selected file; rsync excludes the per-env deploy files; scp ships the **selected** file (droplet destination stays `deploy/.env`); dispatch reads `DEPLOY_CMD` (the positional parameters are shifted during parsing) |
| [`deploy/.env.example`](../../deploy/.env.example) | rewritten header documenting the per-target copy contract |
| `deploy/.env` → `deploy/.env.dev` | migration performed locally (both gitignored) |
| [`.gitignore`](../../.gitignore) | `deploy/.env.local`, `deploy/.env.dev`, `deploy/.env.prod` — **without this `deploy/.env.dev` was committable** (the bare `.env` rule does not match it) |
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) | the rsync `exclude:` list extended with the three per-env deploy files — otherwise CI would upload the operator's droplet address and SSH key path |
| [`scripts/ssh/_remove-ssh-passphrase.sh`](../../scripts/ssh/_remove-ssh-passphrase.sh) | takes an optional target (`dev` default), resolves `deploy/.env.<target>`, migration hint when only the legacy `.env` exists |
| [`scripts/ssh/README.md`](../../scripts/ssh/README.md) | the four `deploy/.env` references |
| [`deploy/README.md`](../../deploy/README.md) | a "Deploy target" callout, the local-prep commands, §10 log naming + examples |
| [`deploy/deploy.ps1`](../../deploy/deploy.ps1) | `.PARAMETER`/`.EXAMPLE`/`.NOTES` document the target (no logic change — arguments already pass through) |
| [`scripts/test/_deploy-sh-env-selection-test.sh`](../../scripts/test/_deploy-sh-env-selection-test.sh) | **new** offline suite, 11 scenarios / 29 assertions |
| `docs/Specs/` | Production-Runbook (new "deploy target" section, examples, sample error output, header date), Local-Development (dev/prod rows), Three-Env-Verification (prerequisites, run commands, troubleshooting row), Caddy-Reverse-Proxy (DOMAIN/ACME_EMAIL source, `down-all` / `up` examples) |

## 4. Bugs and traps found during implementation

Worth recording, because two of them produced *plausible but wrong* results:

1. **The dispatch broke.** Argument parsing `shift`s the positional parameters, but the command
   `case` still read `"${1:-}"` — which after the shift is the *target*. Every command therefore fell
   into the unknown-command branch. The offline suite did not catch it (all its scenarios abort
   before the dispatch); a direct probe did:

   ```
   $ deploy/deploy.sh ps
   ... [INFO ] Loading deploy/.env.dev (target 'dev' from default) ...
   ... [ERROR] unknown command 'ps'
   ```
   Fixed by dispatching on `$DEPLOY_CMD`.

2. **A bare `bash` can be WSL.** With the Windows PATH inherited, `bash` resolves to
   `C:\Users\<user>\AppData\Local\Microsoft\WindowsApps\bash.exe` (the Store WSL stub) *before*
   `/usr/bin/bash`. The first version of the new test called `bash deploy/deploy.sh …`, which ran the
   script **inside WSL** — visible in the log path (`/mnt/e/...` instead of `/e/...`) — where an
   exported `APP_ENV` does not propagate as expected, so two scenarios failed for the wrong reason.
   The suite now runs `"${BASH:-bash}"` (its own interpreter). This is a test-environment artefact,
   not a defect in `deploy.sh` (which spawns no nested bash).

3. **Message quality.** The first parser reported a mistyped target as `unexpected argument
   'staging'`. A bare word is now treated as a *candidate target* so validation can answer with
   `invalid environment 'staging' — valid values are: dev, prod` plus the source of the value.

4. **`.gitignore` gap closed before the file existed.** `deploy/.env.dev` was committable until the
   three new patterns were added; the plan flagged this as the safety-critical item and it is now
   handled in the same change as the rename.

## 5. Verification

```
bash -n deploy/deploy.sh deploy/lib/logger.sh scripts/test/_deploy-sh-env-selection-test.sh \
        scripts/test/_deploy-sh-m1-test.sh scripts/test/_deploy-sh-logger-test.sh \
        scripts/ssh/_remove-ssh-passphrase.sh                                   # all clean

bash scripts/test/_deploy-sh-env-selection-test.sh   # Results: 29 passed, 0 failed
bash scripts/test/_deploy-sh-m1-test.sh              # ALL_OK (7/7 PASS)
bash scripts/test/_deploy-sh-logger-test.sh          # Results: 10 passed, 0 failed
```

Real CLI paths (all abort before any ssh call, so no droplet was touched):

| Command | Expected | Got |
|---|---|---|
| `deploy.sh ps` (default target) | loads `deploy/.env.dev` and the `config:` line names it | ✅ — the real `.env.dev` already carries the dev config, so the run went on to `ssh` and stopped there (`ssh: Could not resolve hostname …`, exit 255, nothing executed remotely) |
| `deploy.sh ps prod` | exit 1, `environment file not found: deploy/.env.prod` + the `cp` hint | ✅ |
| `deploy.sh up staging` | exit 2, `invalid environment 'staging'` + the valid values | ✅ |
| `deploy.sh help` | exit 0, usage documents `[dev|prod]` | ✅ |
| `git check-ignore deploy/.env.dev` | ignored | ✅ (`.gitignore:69`) |
| `deploy.ps1 ps prod` | the same behaviour through the wrapper | ✅ |

The empty-`HOST` branch (`HOST is not set in deploy/.env.<target>`) is asserted by the sandbox suite
(scenarios 4, 5, 7, 8, 9) rather than against the real config, whose `HOST` is already filled in.

## 6. Operator migration

```bash
mv deploy/.env deploy/.env.dev                       # done in this working copy
cp deploy/.env.example deploy/.env.prod              # only when the prod droplet exists
./deploy/deploy.sh ps                                # defaults to dev
./deploy/deploy.sh ps prod
```

A leftover `deploy/.env` is **not** used as a fallback (a silent fallback could deploy to the wrong
droplet); the script detects it and prints the `mv` command instead.

## 7. Follow-ups

* The `prod` target is wired but untested end-to-end: there is no prod droplet, no `deploy/.env.prod`
  and no `DROPLET_HOST_PROD` secret yet. When it exists, the CI half is documented in
  [`deploy/README.md`](../../deploy/README.md:117) (a per-env matrix step + the second secret).
* `scripts/test/_deploy-sh-m3-test.sh` remains red for a pre-existing, unrelated reason (`infra/.env`
  is gitignored and absent from a fresh checkout).
* `deploy/log/` now accumulates per-target files; `DEPLOY_LOG_KEEP` (default 20) bounds it, but the
  retention was not re-measured with two targets in use.
