# Milestone — Image-based droplet bring-up + CI-deploy hardening

**Date:** 2026-10-11 15:55 UTC
**Status:** Applied locally; awaiting commit to `main`
**Files changed:**

- [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) — `--force-recreate`, added `Verify every service is running IMAGE_TAG` step
- [`deploy/deploy.sh`](../../deploy/deploy.sh) — added legacy-compose guard at the top of `up)`.
- [`docs/Specs/Caddy-Reverse-Proxy.md`](../../Specs/Caddy-Reverse-Proxy.md) — §A apex DNS divergence, `Utolsó frissítés` bumped.

---

## 1. Problem

- The operator reported `admin.aisztens.hu`, `api.aisztens.hu`, `web.aisztens.hu` were not serving.
- The `images.yml` runner had successfully built all four images at `sha-3a8f5b6`. So the CI image-build pipeline was fine; the failure was between the build and the public-facing sites.

## 2. Evidence

| Source | Observation |
|---|---|
| `ssh deployer@ssh.aisztens.hu` then `docker ps -a` | Empty — zero containers. |
| `docker images` on droplet | Only legacy `aisztens/api:latest`, `aisztens/monitor:latest`, `caddy:2-alpine`, `postgres:16-alpine`. No GHCR images at any sha. |
| `docker compose config --services` on droplet | 4 services (`api, caddy, monitor, postgres`). Working-tree compose defines 6 (adds `web`, `admin`). |
| `cat /opt/aisztens/infra/docker-compose.yml` on droplet | Legacy 4-service, `build:` blocks for api/monitor, `image: aisztens/*:latest` literals — the pre-`2026-10-08-dockerized-stack-and-image-based-deploy` compose. The image-based compose in the working tree was never shipped. |
| `deploy/log/latest.log` | Last run was **2026-10-10 00:52** (manual `tkovari` from `DESKTOP-5CMS04A`). Ran `prune_legacy_stack` (`docker compose down --remove-orphans` killed all six containers), started rsync upload, and aborted. No `compose up` ever ran. |
| HTTPS probes (post-fix) | `https://api.aisztens.hu/api` 200, `/healthz` 200, `/api/callback-requests` returns `[]`; `https://web.aisztens.hu/` 200; `https://admin.aisztens.hu/` 200 (Hungarian SPA, `lang="hu"`). |

## 3. Root cause

A hand-run `deploy.sh up dev` on 2026-10-10 from a working tree that did not contain a deploy key (or that had drifted), interrupted mid-upload after `prune_legacy_stack` had already destroyed the running stack. With no subsequent successful CI deploy to push the new image-based compose + images, the host stayed in the "stack destroyed, legacy compose on disk" state.

The droplet never received a CI deploy after the 2026-10-08 image-based migration because:

- The `deploy.yml` workflow uses `sparse-checkout` of `infra/{docker-compose.yml,caddy/{Caddyfile,Caddyfile.rendered},apps,packages}`. Only `docker-compose.yml` is shipped, but only when a CI run completes — and since 2026-10-10 no `push to dev` had triggered a fresh deploy.
- `deploy.yml`'s `workflow_run` listener on `images.yml success` does fire when an operator `workflow_dispatch`es `images.yml`, but the operator's 2026-10-11 14:32 run of `images.yml` did not immediately have a matching `deploy.yml` `workflow_run` event in the recent history (visible in the activities tab).

## 4. Solution

### Immediate (droplet-side, manual AI session)

1. Scp'd the working-tree `infra/docker-compose.yml` to the droplet (replacing the legacy 4-service file).
2. Patched the droplet's `infra/.env` with `IMAGE_TAG=sha-3a8f5b6`, `APP_ENV=dev`, `GHCR_OWNER=zakzag`, `REGISTRY=ghcr.io`.
3. `docker compose pull && up -d --force-recreate --remove-orphans`.
4. Verified all four application endpoints over HTTPS.

### Hardening (committed locally; await commit/push)

| Change | Reason |
|---|---|
| `deploy.yml` `up -d --remove-orphans` → `… --force-recreate` | Compose changes always materialise on every CI run; eliminates the silent "live but stale" failure mode. |
| `deploy.yml` new step `Verify every service is running IMAGE_TAG` | A failing image pull / a leftover `aisztens/*:latest` local image / a hand-deployed compose drift is now a **red workflow**, not a silent broken host. |
| `deploy.sh up` guard at the top: refuses if `infra/docker-compose.yml` has a `build:` block or no `${REGISTRY…}` reference | Stops the next operator from accidentally shipping the legacy local-source compose. |

## 5. Verification

| Check | Result |
|---|---|
| All 6 containers up with GHCR images at sha-3a8f5b6 | pass |
| `https://api.aisztens.hu/api` returns 200 | pass |
| `https://api.aisztens.hu/healthz` returns `{"status":"ok", ...}` | pass |
| `https://api.aisztens.hu/api/callback-requests` returns `[]` | pass |
| `https://web.aisztens.hu/` returns 200 (Vite SPA bundle) | pass |
| `https://admin.aisztens.hu/` returns 200 (Hungarian SPA) | pass |
| `bash -n deploy/deploy.sh` and `deploy/lib/logger.sh` | pass |
| YAML brace balance on `.github/workflows/deploy.yml` | pass |
| `docker compose config --services` (droplet) | lists admin, api, caddy, monitor, postgres, web (6) — pass |

## 6. Outcome

- Sites restored: `api.aisztens.hu`, `web.aisztens.hu`, `admin.aisztens.hu` are live with the latest sha-pinned images from today's `images.yml` run (`sha-3a8f5b6`).
- The CI deploy path now enforces that every successful `images.yml` is followed by `deploy.yml` running `up -d --force-recreate` AND verifying the image references.
- The hand-deploy path now refuses to ship a legacy local-source `docker-compose.yml`.

## 7. Follow-ups

- Apex DNS (`aisztens.hu` → `185.80.48.2`) is wrong; redirect and WordPress-on-apex questions are out of this session's scope. See [`docs/Specs/Caddy-Reverse-Proxy.md` §A](../../Specs/Caddy-Reverse-Proxy.md).
- Drop the droplet's legacy `docker-compose.yml.prev-build` and `callback-assistant/*` images manually when convenient (not blocking).
- Consider adding `bash -n` pre-flight to `deploy.yml` for the SSH `run:` blocks.
