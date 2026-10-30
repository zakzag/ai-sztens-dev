# Bring droplet stack back up (image-based) + harden so every CI deploy leaves the host running the freshly-pushed images

**Date:** 2026-10-11 15:50 UTC (session 2026-10-11T15:30–15:50 UTC, Budapest)
**Files touched:**

- [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) — `up -d --remove-orphans` → `up -d --remove-orphans --force-recreate`; added step `7a. Verify every service is running IMAGE_TAG` that fails the workflow if any of the four application services (api/web/admin/monitor) is not pinned to `:sha-<short>` (postgres and caddy exempted — postgres is the official image, caddy uses a floating `caddy:2-alpine` tag).
- [`deploy/deploy.sh`](../../deploy/deploy.sh) — `up)` adds a local-host guard that refuses to deploy if `infra/docker-compose.yml` still contains a `build:` block (legacy source-build compose) or does not reference `${REGISTRY…}` (image-based).
- [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) — added §A apex DNS note + bumped "Utolsó frissítés" to 2026-10-11.
- [`docs/history/2026-10-11--15-50-00-image-based-deploy-host-up-and-hardening.md`](2026-10-11--15-50-00-image-based-deploy-host-up-and-hardening.md) — this entry.
- [`docs/milestones/2026-10-11--15-55-00-image-based-deploy-bring-up-and-hardening.milestone.md`](../milestones/2026-10-11--15-55-00-image-based-deploy-bring-up-and-hardening.milestone.md) — decision-grade summary.

---

## 1. Symptom (reported by the operator)

> "Most `deploy.yml` and `image.yml` runs are working, but the sites are down — `admin.aisztens.hu`, `api.aisztens.hu`, `web.aisztens.hu` are not serving."

Both workflows had already produced fresh `sha-3a8f5b6` images for `api`, `web`, `admin`, and `monitor` (visible in the `images.yml` run log the operator pasted). The droplet was unreachable / not serving.

## 2. Diagnostic sequence and what was found

| #   | Investigation                                                | Finding                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | SSH into droplet (ssh.aisztens.hu as `deployer`, deploy key) | `docker ps -a` empty; nothing listening on 80/443/3000. Stack entirely down.                                                                                                                                                                                                                                                                                                                      |
| 2   | Read `deploy/log/latest.log`                                 | Last run was **2026-10-10 00:52** by user `tkovari` from host `DESKTOP-5CMS04A` (manual `deploy.sh up dev`). It ran `prune_legacy_stack` (`docker compose down --remove-orphans` killed all six containers), then started rsync upload, and **aborted mid-rsync** — the log ends without a footer. No `up` ever ran.                                                                              |
| 3   | `docker images` on the droplet                               | Only `aisztens/api:latest` and `aisztens/monitor:latest` (local-build leftovers) + `caddy:2-alpine` + `postgres:16-alpine`. **No GHCR images cached.**                                                                                                                                                                                                                                            |
| 4   | `docker compose config --services` on the droplet            | Lists **only `api, caddy, monitor, postgres`** (4 services) — the droplet's `/opt/aisztens/infra/docker-compose.yml` is **the OLD local-source-build compose** (date 2026-10-09, 7521 bytes). The current working-tree compose is 8335 bytes and lists 6 services (`api, caddy, monitor, postgres, web, admin`) with `image: ${REGISTRY...}/${GHCR_OWNER...}/aisztens-*:${IMAGE_TAG}` references. |
| 5   | DNS for apex vs subdomains                                   | `aisztens.hu` → `185.80.48.2` (different server, WordPress). `api/web/admin.aisztens.hu` → `164.92.248.194` (droplet). **Apex DNS is wrong** — separate issue, documented in [`docs/Specs/Caddy-Reverse-Proxy.md` §A](../../Specs/Caddy-Reverse-Proxy.md).                                                                                                                                        |
| 6   | `caddy` log tail via SSH                                     | Showed "No such container: caddy" (no containers).                                                                                                                                                                                                                                                                                                                                                |

So the actual chain was: legacy compose on the droplet → operator ran `deploy.sh up` from a local tree that no longer matched the droplet's compose (the local tree had the new image-based compose; the local operator's working copy also lacked the deploy key's expected working state) → `prune_legacy_stack` killed the stack → terminal closed mid-upload → end state: zero containers, no compose aware of the new image-based model, droplet with the OLD compose.

## 3. Bring-up sequence (executed by AI over SSH)

1. Stopped any leftover containers (none).
2. **Scp the current `infra/docker-compose.yml` from the working tree to the droplet**, replacing the 4-service legacy file with the 6-service image-based one. Verified post-`: docker compose ... config --services` lists admin/api/caddy/monitor/postgres/web.
3. Patched `infra/.env` on the droplet: `IMAGE_TAG=sha-3a8f5b6`, `APP_ENV=dev`, `GHCR_OWNER=zakzag`, `REGISTRY=ghcr.io` (using the values written by today's successful `images.yml`).
4. `docker compose pull` — pulled `ghcr.io/zakzag/aisztens-api`, `…-web`, `…-admin`, `…-monitor` at `sha-3a8f5b6` (public packages, no login needed).
5. `docker compose up -d --force-recreate --remove-orphans` — brought up all 6 containers.
6. HTTPS probes:

| URL                                             | Result                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `https://api.aisztens.hu/api`                   | 200 (NestJS routing live)                                                |
| `https://api.aisztens.hu/healthz`               | 200 `{"status":"ok","uptime":40,"timestamp":"2026-10-11T15:48:16.777Z"}` |
| `https://api.aisztens.hu/api/callback-requests` | 200 `[]`                                                                 |
| `https://web.aisztens.hu/`                      | 200 HTML 419 B                                                           |
| `https://admin.aisztens.hu/`                    | 200 HTML, `<html lang="hu">` (Hungarian SPA)                             |
| `https://aisztens.hu/`                          | 200 **but WordPress** (apex DNS wrong — separate issue)                  |

## 4. Why this happened — gap that let a hand-deploy silently pin the host to an old compose

`deploy.yml`'s `appleboy/scp-action` **does** ship `infra/docker-compose.yml` to the droplet on every CI run (line 207). That is correct. The gap was: **a hand run of `deploy.sh up dev` overrides the droplet compose from whatever's in `deploy.sh`'s working tree — and that working tree has no per-deploy compose-fingerprint check that warns the operator the compose does not match the latest CI-published compose.**

When the hand deploy aborted, the droplet kept the last hand-shipped compose (legacy, 4 services, local-build), and no successful CI deploy had run since, so the new image-based compose never reached the droplet.

## 5. Hardening — three changes that prevent this from happening again

| File                           | Change                                                                                                                                                                    | Why                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/deploy.yml` | `up -d --remove-orphans` → `up -d --remove-orphans --force-recreate`                                                                                                      | Ensures that even if `IMAGE_TAG` happens to coincide with the running container's tag, an updated compose file (e.g. new env var, new volume) is materialised on every push.                                                                                                                                                        |
| `.github/workflows/deploy.yml` | New step `Verify every service is running IMAGE_TAG` (after `Pull and start the stack`)                                                                                   | Fails the workflow red if any of `api, web, admin, monitor` is not running an image at `:sha-<short>`. Catches both the "deploy aborts after shipping files but before pulling" case (workflow fails) and the "operator left a local-override image behind" case. Output lists the bad rows and prints the manual recovery command. |
| `deploy/deploy.sh`             | `up)` runs a local-host guard: refuse if `infra/docker-compose.yml` still has a `build:` block (legacy) and warn if no `${REGISTRY…}` reference is present (image-based). | Stops a fresh operator from deploying the old local-source compose accidentally.                                                                                                                                                                                                                                                    |

## 6. Follow-ups (not blocking)

- The apex DNS record (`aisztens.hu`) points to `185.80.48.2`, not the droplet. To make `https://aisztens.hu` redirect to `https://web.aisztens.hu` (per the rendered Caddy config), the regisztrátor DNS panel needs the A record updated to `164.92.248.194`. Documented in `docs/Specs/Caddy-Reverse-Proxy.md §A`. Out of scope for this session.
- The droplet still has a legacy `docker-compose.yml.prev-build` backup, plus `callback-assistant/*` images on disk. Not blocking; left in place for manual inspection.
- Consider adding a `bash -n` pre-flight in the CI `deploy.yml` step that extracts each `run:` block and syntax-checks it (would have caught the previous `tr -d \"'\"` parse bug at PR time).
