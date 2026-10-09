# Plan — automate the two preconditions the deployer path needs

**Date:** 2026-10-07 (Europe/Budapest) · **Author:** code mode (Zoo)

## Why this plan exists

The 22:24–22:38 deploy transcript surfaced three independent failures whose
common root cause was a missing contract between `deploy/deploy.sh` and
`deploy/bootstrap.sh`. The deployer path has two hard preconditions:

| # | Precondition | What established it before today | What broke |
|---|---|---|---|
| P1 | `deployer` can log in (`authorized_keys` populated on the droplet) | an out-of-band copy by the operator (matches the `2026-10-07T15:34` mtime on `/home/deployer/.ssh/authorized_keys` recorded by the live state) | never inside the automation — bootstrap reads keys from `$KEYS_DIR/<user>.pub` while `upload()` rsync-excludes the whole `deploy/ssh-keys/` directory, so the warning is deterministic, not situational |
| P2 | `/opt/aisztens` is owned by the login user | the operator TODO at [`docs/milestones/2026-10-07--16-36-00-deploy-deployer-user.milestone.md:69`](2026-10-07--16-36-00-deploy-deployer-user.milestone.md:69) | rsync `-a` implies `-t`/`-p`, which need ownership (`CAP_FOWNER`) — `deployer` could write into a 777 tree but not `utimes()` its dirs → `exit 23`. The preflight's `touch`+`rm` test passes, and the guard reports success |
| P3 | secret files are `0600` | not established at all | scp inherits the source mode; `drvfs` reports `0666` for everything under `/mnt/e`, so `infra/.env` and `deploy/.env` (DB passwords, `VAPI_WEBHOOK_SECRET`) ship world-readable |

Plus a satellite bug: the `monitor` image on the running droplet was baked from a
copy of `watch.sh` containing CRLF line endings; the kernel `execve` of
`/app/watch.sh` fails with `ENOENT` because the interpreter path becomes
`/bin/sh\r`, and the container has been in a `Restarting (255)` loop.

## Goal

Turn P1, P2 and P3 from operator TODO into automation that bootstrap runs in the
same root-privileged window. Add a positive ownership check to
`assert_remote_ready()` so a future regression aborts before rsync instead of
producing a 43-line `failed to set times` wall.

## Changes

| File | Change |
|---|---|
| [`deploy/deploy.sh`](../../deploy/deploy.sh:786) | In the `bootstrap)` branch, after `upload()` but before `run_remote "sudo bash deploy/bootstrap.sh"`: `scp` **only** the `*.pub` halves under `deploy/ssh-keys/` onto the droplet, fail early if none are present locally. The existing `--exclude 'deploy/ssh-keys/'` on the main rsync is preserved, so the private key is still excluded. |
| [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh:19) | New `DEPLOY_USER=deployer` default with a comment naming the bug it closes. |
| [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh:75) | `create_user` now **errors** for any sudo user missing a `.pub` (was a `WARNING`). The app user is still allowed to exist without a key. |
| [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh:159) | The user loop aggregates failures and exits 1 if any sudo user lacked a key, so bootstrap can never exit 0 in a state where day-to-day deploys (run as `$DEPLOY_USER`) cannot log in. |
| [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh:170) | After the user loop: `chown -R $DEPLOY_USER:$DEPLOY_USER /opt/aisztens`, `chmod 600 infra/.env deploy/.env`, `chmod -R o-w`. Removes the operator TODO at milestone 16:36 §6. |
| [`deploy/deploy.sh`](../../deploy/deploy.sh:643) | `assert_remote_ready()` now compares the `OWNER=` it already collected against `$SSH_USER` and aborts with the `chown` one-liner — turns run 2's false `Preflight OK` into a self-explaining abort. Skipped when running as `root`, so the one-off bootstrap login still works. |
| [`scripts/test/_deploy-sh-remote-compose-path-test.sh`](../../scripts/test/_deploy-sh-remote-compose-path-test.sh:69) | New `wrongowner` stub mode (`WRITABLE` + `OWNER=root:root 755`). |
| [`scripts/test/_deploy-sh-remote-compose-path-test.sh`](../../scripts/test/_deploy-sh-remote-compose-path-test.sh:264) | **Scenario 7** — writable but wrong owner → preflight aborts with the `chown` fix, no rsync attempt. |
| [`scripts/test/_deploy-sh-remote-compose-path-test.sh`](../../scripts/test/_deploy-sh-remote-compose-path-test.sh:283) | **Scenario 8** — `bootstrap dev` ships `deployer.pub`/`aisztens.pub`, never `deploy.private.key`, then runs `sudo bash deploy/bootstrap.sh`. |

## How to verify

```bash
# 1. the offline test suite (now 38 assertions, 6 new)
bash scripts/test/_deploy-sh-remote-compose-path-test.sh

# 2. the one-off droplet repair (only needed until the next bootstrap)
ssh -i ~/.ssh/aisztens-deploy.key root@ssh.aisztens.hu \
  'chown -R deployer:deployer /opt/aisztens && \
   chmod 600 /opt/aisztens/infra/.env /opt/aisztens/deploy/.env'

# 3. acceptance: re-run bootstrap so keys are installed from the *.pub stage,
#    then flip SSH_USER=deployer and run ./deploy/deploy.sh up dev
SSH_USER=root ./deploy/deploy.sh bootstrap dev
sed -i 's|^SSH_USER=root$|SSH_USER=deployer|' deploy/.env.dev
./deploy/deploy.sh up dev

# 4. confirm: no "WARNING: no public key …" lines, "Installed SSH key for …" x4,
#    preflight prints "(owner=deployer)", exit 0, all four containers healthy.
```

If any new assertion fails, paste `deploy/log/latest.log`; the new preflight
will name exactly which attribute (owner / perms / connectivity) is wrong
instead of letting rsync die with `exit 23`.

## Out of scope (follow-ups)

- `pnpm not found … skipping SPA build` should fail loudly if `dist/` is older
  than `src/` (or, ideally, refuse to deploy when pnpm is absent).
- The 1 GB memory ceiling on the build host + 5m49s `pnpm install` is not in
  scope for this plan.
- The four `*.pub` files are gitignored; the CI path cannot provision them
  without an explicit hand-off (env var, s3, etc.). Recorded separately.