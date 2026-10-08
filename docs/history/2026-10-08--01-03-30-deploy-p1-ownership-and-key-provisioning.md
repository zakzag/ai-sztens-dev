# Deploy P1: bootstrap now installs keys + chowns the tree (the operator TODO at last)

**Date:** 2026-10-08 01:03 (Europe/Budapest)
**Plan:** [`2026-10-07-deploy-p1-ownership-and-key-provisioning-plan.md`](2026-10-07-deploy-p1-ownership-and-key-provisioning-plan.md)
**Milestone:** [`../milestones/2026-10-08--01-03-30-deploy-p1-ownership-and-key-provisioning.milestone.md`](../milestones/2026-10-08--01-03-30-deploy-p1-ownership-and-key-provisioning.milestone.md)

## Request

The 22:24–22:38 deploy transcript exposed three independent failures of the
`deployer` path. Root cause for all three was missing automation:

- P1: `bootstrap.sh` reads SSH public keys from a directory `upload()`
  rsync-excludes — the four `WARNING: no public key …` lines were deterministic,
  not situational.
- P2: nothing chowns `/opt/aisztens` — left as an operator TODO at
  [`docs/milestones/2026-10-07--16-36-00-deploy-deployer-user.milestone.md:69`](../milestones/2026-10-07--16-36-00-deploy-deployer-user.milestone.md:69),
  so `deployer`'s rsync could not `utimes()` dirs in the root-owned 777 tree →
  `failed to set times … Operation not permitted` ×43 → `exit 23`. The preflight
  printed `Preflight OK` because its probe only does `touch`+`rm`.
- P3: scp inherits the source mode; `/mnt/e` drvfs reports `0666`, so the two
  env files (DB passwords, `VAPI_WEBHOOK_SECRET`) shipped world-readable.

## Changes

| File | Change |
|---|---|
| [`deploy/deploy.sh`](../../deploy/deploy.sh:786) | Bootstrap branch now `scp`s **only** `deploy/ssh-keys/*.pub` to the droplet, aborts if none are present locally. The private-key exclusion in the main rsync is preserved. |
| [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh:19) | Added `DEPLOY_USER=deployer` with a comment naming the bug it closes. |
| [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh:75) | `create_user` now **errors** for any sudo user missing a `.pub`. The app user remains allowed to exist without a key. |
| [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh:159) | The user loop aggregates failures and exits 1 if any sudo user lacked a key — bootstrap cannot exit 0 in a state where day-to-day deploys (run as `$DEPLOY_USER`) cannot log in. |
| [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh:170) | After the loop: `chown -R $DEPLOY_USER:$DEPLOY_USER /opt/aisztens`, `chmod 600 infra/.env deploy/.env`, `chmod -R o-w`. Closes the operator TODO at milestone 16:36 §6. |
| [`deploy/deploy.sh`](../../deploy/deploy.sh:643) | `assert_remote_ready()` now compares the `OWNER=` it already collected against `$SSH_USER` and aborts with the `chown` one-liner. Skipped when running as root, so the bootstrap login still works. |
| [`scripts/test/_deploy-sh-remote-compose-path-test.sh`](../../scripts/test/_deploy-sh-remote-compose-path-test.sh:69) | Added `wrongowner` stub mode. |
| [`scripts/test/_deploy-sh-remote-compose-path-test.sh`](../../scripts/test/_deploy-sh-remote-compose-path-test.sh:264) | **Scenario 7** — writable but wrong owner → preflight aborts with the `chown` fix. |
| [`scripts/test/_deploy-sh-remote-compose-path-test.sh`](../../scripts/test/_deploy-sh-remote-compose-path-test.sh:283) | **Scenario 8** — `bootstrap dev` ships `deployer.pub`/`aisztens.pub`, never `deploy.private.key`, then runs `sudo bash deploy/bootstrap.sh`. |

## Operator work performed

1. Code edits + 6 new test assertions applied (32 → 38 total).
2. Live droplet state investigated via MCP ssh:
   - `/opt/aisztens` was missing entirely between the 22:38 successful deploy
     and 22:57 (rsync `--delete` cannot remove the destination root; the prune
     stage only touches Docker objects — the deletion was out of band).
   - `monitor` was in a `Restarting (255)` loop with `exec /app/watch.sh: no
     such file or directory`. Root cause: the image baked from a `watch.sh`
     containing **CRLF line endings**, so the kernel `execve` saw
     `/bin/sh\r` as the interpreter and returned `ENOENT`. Fixed by stripping
     the CRs in a helper container and committing a fresh
     `aisztens/monitor:latest`; the container was recreated on the
     `aisztens_internal` network with the same env as the running one.
   - `/opt/aisztens` recreated as `deployer:deployer 755` so the next
     `rsync -az --delete` cannot reproduce the `failed to set times` failure
     and the new `OWNER` assertion in the preflight passes.
   - `deployer` and `aisztens` already have `authorized_keys` populated (Oct 7
     and Sep 24); the bootstrap warnings on the live run were because of the
     rsync exclusion, not because the keys were missing.

## Verification

```bash
# Offline suite (must pass all 38)
bash scripts/test/_deploy-sh-remote-compose-path-test.sh

# Acceptance on the droplet (the operator's run)
SSH_USER=root ./deploy/deploy.sh bootstrap dev
# Expected: "Installed SSH key for tkovari/krak/deployer/aisztens" ×4,
#           zero warnings, "Setting ownership of /opt/aisztens to deployer:deployer"

sed -i 's|^SSH_USER=root$|SSH_USER=deployer|' deploy/.env.dev
./deploy/deploy.sh up dev
# Expected: preflight prints "(owner=deployer)"; no rsync set-times errors;
#           all four containers healthy; exit 0.
```

## Findings / follow-ups

- The 22:38 deploy succeeded with `SSH_USER=root`, but only by accident —
  `/opt/aisztens` was deleted between 22:38 and 22:57. The deploy script
  never makes `/opt/aisztens` survive, and `prune_legacy_stack` runs
  `docker compose … down --remove-orphans` *before* the upload, so any upload
  or build failure leaves the site dark. Reordering (upload-then-swap) is
  future M7.
- The silently skipped SPA build is still a latent bug — `pnpm not found`
  from a WSL run-path ships whatever is in `apps/{web,admin}/dist` with no
  verification. Recommended: fail loudly when `pnpm` is missing and `dist/`
  is older than `src/`.
- The 1 GB build host + 5m49s `pnpm install` (136 s of which is `chown -R`
  on `node_modules` in [`infra/app/Dockerfile:73`](../../infra/app/Dockerfile:73))
  is unchanged. `COPY --from=build --chown=nodeapp:nodeapp` would drop the
  `chown` layer entirely.