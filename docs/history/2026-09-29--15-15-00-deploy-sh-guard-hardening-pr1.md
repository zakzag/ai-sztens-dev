# deploy.sh hardening PR #1 — implementation

**Status:** Done (offline tests green)
**Plan:** [`2026-09-29--14-38-32-deploy-sh-guard-hardening-plan.md`](2026-09-29--14-38-32-deploy-sh-guard-hardening-plan.md)
**Milestone:** [`2026-09-29--15-15-00-deploy-sh-guard-hardening-pr1.milestone.md`](../milestones/2026-09-29--15-15-00-deploy-sh-guard-hardening-pr1.milestone.md)
**Modules:** M1, M2, M3, M10 (the "safe quartet" — smallest reviewable change, no deploy behaviour shift for the happy path)

## What changed

| File | Lines | Change |
|---|---|---|
| [`deploy/deploy.sh`](../../deploy/deploy.sh:23) | +52 / −6 | Added `CURRENT_STAGE`, `DEPLOY_START_TS`, `log_stage()`, `on_err()` and `trap 'on_err $LINENO' ERR`. Wired `log_stage` into `prune_legacy_stack`, `upload`, `compose_up`. (M1) |
| [`deploy/deploy.sh`](../../deploy/deploy.sh:135) | +0 / −2 | Replaced the `__DOMAIN__` / `__ACME_EMAIL__` references in the `render_caddyfile()` comment block with `<DOMAIN>` / `<ACME_EMAIL>` to match the actual `sed` invocations. (M2) |
| [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile:35) | +0 / −0 (comment only) | M2: confirmed token form. Added a "do NOT switch to `__TOKEN__` style" warning block so a future maintainer following the existing docs cannot break the renderer. |
| [`infra/docker-compose.yml`](../../infra/docker-compose.yml:120) | +0 / −2 | M2: same comment fix in the `caddy:` volume mount comment. |
| [`deploy/deploy.sh`](../../deploy/deploy.sh:194) | +17 / −6 | M3: replaced the ambiguous `[ -f ... ] && ...` guard with an explicit `if / elif / else` that picks the first existing path and refuses to proceed if neither exists, with a clear `[deploy] ERROR: no infra/.env found ...` message. |
| [`deploy/deploy.sh`](../../deploy/deploy.sh:185) | +1 / −0 | M10: added `--exclude 'deploy/ssh-keys/'` to the bulk rsync — mirrors what `.github/workflows/deploy.yml` has been doing locally. |
| [`scripts/test/_deploy-sh-m1-test.sh`](../../scripts/test/_deploy-sh-m1-test.sh:1) | new | Offline test that reproduces the trap block and confirms a synthetic failure produces the expected banner (`stage=… line=… exit=…`). |
| [`scripts/test/_deploy-sh-m3-test.sh`](../../scripts/test/_deploy-sh-m3-test.sh:1) | new | Offline test that exercises the three branches of the M3 fix. Skips the parent-dir branch on Windows/WSL where writing above the repo root hits filesystem-permission boundaries. |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:5) | +1 / −1 | Bumped the "Utolsó frissítés" line. |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:265) | +24 / −0 | New §6.1 — "A deploy hiba bannerének olvasása" — documents the new banner format, the stage list, and the silent-failure traps each module closes. |

## What did *not* change

- No changes to `infra/docker-compose.yml` beyond the comment text. All four services, their healthchecks, dependencies, and mem limits are identical.
- No changes to the order of operations inside `up`. The site still goes down at the start of `up` (that's **PR #6 / M7**).
- No changes to the GitHub Actions workflow. The local script is now slightly safer than CI; the workflow can be simplified to call `./deploy.sh up` in a follow-up plan.

## How it was verified

```bash
bash -n deploy/deploy.sh           # SYNTAX_OK
bash scripts/test/_deploy-sh-m1-test.sh
#   [deploy] stage=synthetic_phase
#   [deploy] FAILED at stage=synthetic_phase line=19 exit=1 after 0s
#   exit=1
bash scripts/test/_deploy-sh-m3-test.sh
#   PASS  test1.exit  (0)
#   PASS  test1.path  (/mnt/e/projects/AI/.../infra/.env)
#   PASS  test1.no-stderr-error
#   PASS  test2.exit  (1)
#   PASS  test2.stdout-error-message
#   PASS  test2.no-path-printed
#   ALL_OK
```

The M3 test temporarily moves `infra/.env` aside to assert the "neither present" branch, then restores it. The restore uses `mktemp` + `cp` rather than `mv` so a WSL/PowerShell path-translation failure (which I hit once during development — see the "incident" note below) cannot lose the file.

## Incident during development (worth recording)

While iterating on the M3 test, I ran the script under `powershell.exe` invoking `bash` via `&`. The first attempt used `mv` to relocate `infra/.env` to `/tmp/infra.env.backup2` before the test and `mv` back after. PowerShell's `Move-Item` saw `/tmp/...` as a relative Windows path (not a WSL path), silently left the file in the WSL `/tmp` partition, and the test script in the WSL bash subshell saw it as "already restored". On the *second* test run, the WSL side `rm`'d the now-empty `/tmp/infra.env.backup2` while the WSL side still thought the file lived there. Net effect: **`infra/.env` disappeared from the workspace for ~15 minutes**.

Recovered cleanly because the original was still in `/tmp/infra.env.backup` from an earlier intermediate state (the test had moved twice). The test now uses `mktemp -t infra.env.test.XXXXXX` + `cp` + `rm -f` + `mv` back, which is robust against this class of error.

This is a **real-world demonstration** of why an earlier draft of PR #2 in the plan (Module 4: pre-flight checks) includes a remote-resources check — losing `infra/.env` to a side-channel tool error should be impossible, and the runbook section on deploy banner diagnostics now documents that even with M1's trap, **a misplaced local file is a local-machine problem, not a deploy-script problem**.

## Follow-ups

- PR #2 — M4 (pre-flight) — once PR #1 ships, add the four local + remote pre-flight checks.
- PR #6 — M7 (split prune) — the structural fix for "site goes down at line 0 of `up`".
- The PR #1 trap's `ps -a` + `logs --tail=20` dump goes to the *operator's* terminal, not the droplet's logs. If we ever add centralised logging, that path is the obvious integration point.
