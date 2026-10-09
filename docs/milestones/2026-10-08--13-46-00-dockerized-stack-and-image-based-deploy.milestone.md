# Milestone — Fully Dockerized stack and image-based deploy

**Date:** 2026-10-08
**Status:** Plan approved, implementation pending
**Plan:** [`docs/history/2026-10-08-dockerized-stack-and-image-based-deploy-plan.md`](../history/2026-10-08-dockerized-stack-and-image-based-deploy-plan.md)

---

## 1. Problem / feature

The project was supposed to run entirely in Docker containers, but two components and the whole
delivery mechanism did not:

1. `web` and `admin` are **not containers**. They are built outside Docker and their `dist/`
   folders are rsynced onto the bare droplet, where a Caddy bind mount serves them.
2. The `api` and `monitor` **images are built on the droplet**. This forces the entire repository
   (sources, workspace, lockfile) onto the server and runs `pnpm install` + `nest build` inside a
   memory-capped droplet.

## 2. Measured data / evidence

| Observation | Source |
|---|---|
| `web`/`admin` built outside Docker, `dist/` copied to the host | [`build_spas()`](../../deploy/deploy.sh:541), [`upload_dists()`](../../deploy/deploy.sh:562) |
| Caddy serves SPAs from host bind mounts `../apps/{web,admin}/dist` | [`infra/docker-compose.yml`](../../infra/docker-compose.yml:139) |
| Droplet build: `docker compose up -d --build` over SSH | [`infra/docker-compose.yml`](../../infra/docker-compose.yml:19), [`deploy/deploy.sh`](../../deploy/deploy.sh:1074), [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:247) |
| Whole repo SCP'd to `/opt/aisztens` on every deploy | [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml:138) |
| pnpm-native OOM restart loops traced to running the build/runtime under a 400 MB cap | [`docs/milestones/2026-09-29--00-34-49-api-healthcheck-fail.milestone.md`](2026-09-29--00-34-49-api-healthcheck-fail.milestone.md) |

## 3. Root cause / design rationale

The deploy script was designed as a **file-copy deploy** (`rsync` + `scp` + build remotely) rather
than an **image deploy**. Because the SPA had no Dockerfile, the only way to serve it was to place
built files on the host and bind-mount them. Because the API image had no published registry
target, the only way to build it was on the droplet itself.

Two options were considered:

- **Single container for everything** — rejected. `postgres` and `caddy` are upstream images;
  merging them would lose per-service `mem_limit`, independent restart and healthcheck isolation.
- **One container per component, built in CI, pulled on the droplet** — chosen. It removes all
  host-side code, makes the droplet reproducible, and gives exact-hash rollback.

## 4. Planned implementation (file inventory)

| File | Change |
|---|---|
| `infra/web/Dockerfile` | New. Multi-stage Node/pnpm build → `nginx:1.27-alpine` runtime for the web SPA |
| `infra/web/nginx.conf` | New. SPA fallback, gzip, immutable asset caching |
| `infra/admin/Dockerfile` | New. Same shape for the admin SPA |
| `infra/admin/nginx.conf` | New. Same as the web config |
| `.github/workflows/images.yml` | New. Build + push the four images to GHCR (`sha-<sha>` + env tag) |
| `infra/docker-compose.yml` | `api`/`monitor` become `image:`-only; add `web` and `admin`; drop SPA bind mounts |
| `infra/docker-compose.local.yml` | Host the `build:` blocks so local dev still builds from source |
| `infra/caddy/Caddyfile` | `web.<DOMAIN>` / `admin.<DOMAIN>` become `reverse_proxy` |
| `infra/.env.example` | Add `IMAGE_TAG` + registry docs; remove `WEB_DIST_PATH` / `ADMIN_DIST_PATH` |
| `.github/workflows/deploy.yml` | Ship 3 files, then `pull` + `up -d` without `--build` |
| `deploy/deploy.sh` | Simplified to the same ship-3-files + pull + up flow |
| `scripts/test/stack-smoke.sh` (+ prelude) | `--up` builds through the local override |
| `deploy/README.md`, `scripts/README.md`, `docs/Specs/*` | Reflect the new flow and the `web`/`admin` containers |

## 5. Outcome and how to verify

The droplet holds only `infra/docker-compose.yml`, `infra/.env` and
`infra/caddy/Caddyfile.rendered`; all six services run from images.

```bash
# on the droplet
cd /opt/aisztens
docker compose -f infra/docker-compose.yml --env-file infra/.env pull
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d
docker compose -f infra/docker-compose.yml ps -a          # api, web, admin, postgres, caddy, monitor all Up
curl -fsSI "https://web.$(grep '^DOMAIN=' infra/.env | cut -d= -f2)/"    # 200, served by the web container
```

## 6. Follow-ups

- Automatic rollback when the smoke suite fails.
- Image vulnerability scanning in the build workflow.
- dev/prod matrix in `images.yml` once the prod droplet exists.
