# Milestone — bootstrap now installs SSH keys and chowns the deploy tree

**Date:** 2026-10-08 01:03 (Europe/Budapest) · **Author:** code mode (Zoo)
**Narrative:** [`../history/2026-10-08--01-03-30-deploy-p1-ownership-and-key-provisioning.md`](../history/2026-10-08--01-03-30-deploy-p1-ownership-and-key-provisioning.md) · **Plan:** [`…-deploy-p1-ownership-and-key-provisioning-plan.md`](../history/2026-10-07-deploy-p1-ownership-and-key-provisioning-plan.md)

## 1. Problem / feature

The `deployer` path had three silent preconditions that no automation
established. Two of them (P1, P2) had survived for at least one milestone
cycle — the P2 `chown` was a documented operator TODO at
[`docs/milestones/2026-10-07--16-36-00-deploy-deployer-user.milestone.md:69`](../milestones/2026-10-07--16-36-00-deploy-deployer-user.milestone.md:69)
since the 16:36 deploy. The 22:25 run paid for it: 43 ×
`failed to set times … Operation not permitted` → `rsync exit 23`. The
preflight printed `Preflight OK` because its probe only does `touch`+`rm`.

## 2. Measured data / evidence

| # | Check | Result |
|---|---|---|
| 1 | `deploy.sh up dev` @ 22:25 | `rsync -az --delete` aborted with exit 23; tree was root-owned 777 |
| 2 | `assert_remote_ready()` `@22:25` | printed `Preflight OK` (false negative); the `OWNER=` it collected was never compared against the login user |
| 3 | `deploy.sh bootstrap dev` (live) | four `WARNING: no public key at …` lines; `*.pub` files live in `deploy/ssh-keys/`, which `upload()` rsync-excludes |
| 4 | Live state at 22:57 | `/opt/aisztens` missing; `monitor` in `Restarting (255)` loop; `monitor` image contained CRLF-line-ending `watch.sh`, so kernel `execve` returned `ENOENT` |
| 5 | `deployer`'s `authorized_keys` | already present, mtime `2026-10-07T15:34` — bootstrap had been run out-of-band before, but the key transport path is not in the deploy script |

## 3. Root cause / design rationale

The deploy script makes two hard preconditions true before day-to-day
deploys can succeed; it never makes them true itself:

- the deploy tree must be writable **and owned** by the login user (so
  `rsync -a`'s `-t`/`-p` work — they need `CAP_FOWNER`);
- the SSH public keys must already be at `$KEYS_DIR/<user>.pub` on the
  droplet before `bootstrap.sh` runs (or `create_user()` always warns).

Both preconditions live entirely in a privileged window the script can
already enter — `bootstrap` runs as root. Moving them into `bootstrap.sh`
makes a fresh droplet truly self-provisioning.

## 4. Solution / implementation

| File | Change |
|---|---|
| [`deploy/deploy.sh`](../../deploy/deploy.sh:786) | Ship `*.pub` from `deploy/ssh-keys/` to `$REMOTE_DIR/deploy/ssh-keys/` before invoking `bootstrap.sh`. Aborts if no `.pub` exists locally. |
| [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh:19) | New `DEPLOY_USER` env (default `deployer`). |
| [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh:75) | `create_user` now errors on missing sudo-user keys; app user remains allowed. |
| [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh:170) | Post-loop: `chown -R` + `chmod 600` + `chmod -R o-w`. |
| [`deploy/deploy.sh`](../../deploy/deploy.sh:643) | `assert_remote_ready()` compares `OWNER=` to `$SSH_USER`. Skipped when running as root. |
| [`scripts/test/_deploy-sh-remote-compose-path-test.sh`](../../scripts/test/_deploy-sh-remote-compose-path-test.sh:264) | Scenarios 7 and 8 — owner mismatch + `bootstrap dev` pub-shipping. |
| Live droplet | Recreated `/opt/aisztens` as `deployer:deployer 755`; stripped CRLF from the `monitor` image's `/app/watch.sh` and committed a fresh `aisztens/monitor:latest`; recreated the `monitor` container on `aisztens_internal`. |

## 5. Outcome and how to verify

```bash
bash scripts/test/_deploy-sh-remote-compose-path-test.sh   # 38 passed (6 new)

SSH_USER=root ./deploy/deploy.sh bootstrap dev
# → "Installed SSH key for tkovari/krak/deployer/aisztens" ×4
# → "Setting ownership of /opt/aisztens to deployer:deployer"

sed -i 's|^SSH_USER=root$|SSH_USER=deployer|' deploy/.env.dev
./deploy/deploy.sh up dev
# → "Preflight OK … (owner=deployer)"; no rsync set-times errors; exit 0.
```

## 6. Follow-ups

- The "skip SPA build" branch at [`deploy/deploy.sh:517`](../../deploy/deploy.sh:517)
  silently returns 0 and ships whatever `dist/` happens to contain — a
  stale build against `localhost` would be served. Should fail loudly when
  `dist/` is older than `src/` and pnpm is absent.
- The 1 GB build host still pays 136 s of `chown -R` on `node_modules`
  ([`infra/app/Dockerfile:73`](../../infra/app/Dockerfile:73)) on every
  image rebuild. `COPY --from=build --chown=nodeapp:nodeapp` removes it.
- `prune_legacy_stack` runs `docker compose down` *before* upload ([`deploy/deploy.sh:747`](../../deploy/deploy.sh:747)),
  so any upload/build failure leaves the site dark. Upload-then-swap is
  future M7.