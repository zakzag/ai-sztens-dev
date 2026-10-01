# Milestone — `deploy.sh` hardening PR #1 (M1, M2, M3, M10)

**Date:** 2026-09-29
**Plan:** [`docs/history/2026-09-29--14-38-32-deploy-sh-guard-hardening-plan.md`](../history/2026-09-29--14-38-32-deploy-sh-guard-hardening-plan.md)
**History:** [`docs/history/2026-09-29--15-15-00-deploy-sh-guard-hardening-pr1.md`](../history/2026-09-29--15-15-00-deploy-sh-guard-hardening-pr1.md)

## 1. Problem

`./deploy/deploy.sh up` was guarded only by `set -euo pipefail`. Three latent failure modes were identified in the audit:

- **M1** Every abort surfaced as "line N: command failed" with no clue which *phase* died (prune, rsync, build, compose). The trap also did not dump remote context, so triage meant another SSH into the droplet.
- **M2** The Caddyfile-template comments referenced `__DOMAIN__` / `__ACME_EMAIL__` tokens, but the renderer actually used `<DOMAIN>` / `<ACME_EMAIL>`. A future maintainer following the comments would have shipped an unresolved placeholder to Caddy → `subject does not qualify for certificate` restart loop.
- **M3** The `infra/.env` scp branch was guarded by `[ -f "$REPO_DIR/../infra/.env" ] || [ -f "$REPO_DIR/infra/.env" ]`, but the body only assigned `local_infra_env` from the repo path. If only the parent-dir file existed, the standalone `[ -f ... ] && ...` list returned 1 and `set -e` aborted the whole deploy (otherwise it would have `scp ""`).
- **M10** The bulk rsync did not exclude `deploy/ssh-keys/`, even though `deploy/ssh-keys/.gitignore` only ignores `*.pub`. A local machine with private keys (`.pem`, `.key`, `.ppk`) in that directory would push them to the droplet unencrypted.

## 2. Measured evidence

- All four failure classes were reproduced offline; the M1 trap produces the exact banner promised (`stage=… line=… exit=…`); the M3 fix produces `exit=1` plus the clear `[deploy] ERROR: no infra/.env found ...` message in both the "parent dir only" and "no file at all" branches.
- `bash -n deploy/deploy.sh` → `SYNTAX_OK`.
- `grep -rn '__DOMAIN__\|__ACME_EMAIL__' deploy infra docs` returns matches **only** inside the plan file itself (where the legacy form is documented as a learning artifact), not in code or specs.

## 3. Solution

Smallest reviewable change. All four modules ship in a single PR because none of them alter the runtime behaviour of a healthy deploy — they only change what an operator sees when something goes wrong (M1), what a maintainer sees when adding a token (M2), what happens when a `.env` is misplaced (M3), and what gets pushed to the droplet from a developer's local checkout (M10).

| Module | One-line summary |
|---|---|
| M1 | `CURRENT_STAGE` + `on_err` `ERR` trap, dumps `docker compose ps -a` + `logs --tail=20` on first failure |
| M2 | Comment/code convergence to `<DOMAIN>` / `<ACME_EMAIL>` in `deploy.sh`, `infra/caddy/Caddyfile`, `infra/docker-compose.yml` |
| M3 | Explicit `if / elif / else` for `infra/.env` resolution with a clear `ERROR:` line |
| M10 | `--exclude 'deploy/ssh-keys/'` on the bulk rsync mirror |

## 4. Files changed

| File | What |
|---|---|
| [`deploy/deploy.sh`](../../deploy/deploy.sh:23) | M1 trap + stage markers |
| [`deploy/deploy.sh`](../../deploy/deploy.sh:135) | M2 comment fix |
| [`deploy/deploy.sh`](../../deploy/deploy.sh:194) | M3 path resolution |
| [`deploy/deploy.sh`](../../deploy/deploy.sh:185) | M10 rsync exclude |
| [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile:35) | M2 token-form warning |
| [`infra/docker-compose.yml`](../../infra/docker-compose.yml:120) | M2 comment fix |
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md:265) | New §6.1 documenting the banner format |
| [`scripts/test/_deploy-sh-m1-test.sh`](../../scripts/test/_deploy-sh-m1-test.sh:1) | Offline test for the trap |
| [`scripts/test/_deploy-sh-m3-test.sh`](../../scripts/test/_deploy-sh-m3-test.sh:1) | Offline test for the path-resolution fix |

## 5. Outcome and how to verify

- Run `./deploy/deploy.sh up`. A successful run now also prints `[deploy] → stage=...` at each phase boundary, so an operator can see at a glance how far the script got.
- Force a failure (e.g., temporarily rename `apps/web/src/main.tsx` to introduce a TS error). The script aborts with a banner of the form `FAILED at stage=… line=… exit=… after Ns`, followed by the remote `ps -a` + `logs --tail=20`.
- Move `infra/.env` to a sibling directory, run `./deploy.sh up`. The script aborts at the new `if / elif / else` with the explicit `[deploy] ERROR: no infra/.env found ...` message, **before** any remote work.
- Drop a fake private key at `deploy/ssh-keys/test.key`, run `./deploy.sh up`, SSH into the droplet, `find /opt/aisztens/deploy/ssh-keys -type f` — the file is not there.
- Run `bash scripts/test/_deploy-sh-m1-test.sh` and `bash scripts/test/_deploy-sh-m3-test.sh` locally — both print `ALL_OK` / the expected banner.

## 6. Follow-ups

- PR #2 (M4): add `deploy/lib/preflight.sh` with local-tool + remote-reachability + remote-resources + `docker compose config` checks.
- PR #3 (M5 + M9): reorder `upload()` so SPAs build *before* rsync, and turn the silent pnpm-skip into a hard failure.
- PR #6 (M7): the structural fix — split `prune_legacy_stack` so the current project is not torn down at the start of `up`. After PR #6, an interrupted deploy no longer implies downtime.
