# Plan: Run the Stack Locally in WSL Debian

- Date: 2026-09-18
- Status: Done
- Scope: Make it possible to bring up the Callback Assistant stack on the developer's
  Windows machine inside WSL (Debian) instead of the DigitalOcean droplet.

## 1. Context

The existing `infra/` files target a public Ubuntu droplet (public DNS, Let's Encrypt via
Caddy, SSH users, UFW). On a local WSL Debian:

- The network is NAT (`eth0` on `172.18.x.x`); Windows reaches WSL via `localhost`.
- There is no public domain, so Caddy cannot obtain a Let's Encrypt certificate.
- `systemd` is not running by default, which affects Docker installation and startup.
- The SSH user / UFW bootstrap is irrelevant for local use.

## 2. What Was Added

- [`infra/docker-compose.wsl.yml`](../../infra/docker-compose.wsl.yml) — a local override that:
  - publishes the API on `localhost:3000`,
  - publishes Postgres on `localhost:5432`,
  - disables the Caddy service via a `never` profile.
- The override is merged explicitly with `-f infra/docker-compose.yml -f infra/docker-compose.wsl.yml`,
  so the droplet deployment (which only passes `-f infra/docker-compose.yml`) is unaffected.

## 3. How to Run Locally

1. Install Docker (either Docker Desktop with WSL integration, or native Docker in WSL — see README).
2. `cp infra/.env.example infra/.env` and fill the required values
   (`POSTGRES_PASSWORD`, `TKOVARI_DB_PASSWORD`, `KRAK_DB_PASSWORD`, `AISZTENS_DB_PASSWORD`).
3. From the repo root inside WSL:
   `docker compose --env-file infra/.env -f infra/docker-compose.yml -f infra/docker-compose.wsl.yml up -d --build`
4. Verify: `curl http://localhost:3000/api` and
   `curl http://localhost:3000/api/callback-requests`.

## 4. Out of Scope

- The droplet-only parts (`deploy/bootstrap.sh` users/UFW, Caddy TLS) are not needed locally
  and are intentionally not applied.

## 5. Follow-ups

- Optionally run the Vite dev servers (`pnpm dev`) on Windows for the web/admin clients; they
  proxy `/api` to `localhost:3000` already.

## 6. Troubleshooting: ERR_PNPM_IGNORED_BUILDS

The first Docker build failed with `ERR_PNPM_IGNORED_BUILDS` for `@parcel/watcher`,
`esbuild` and `unrs-resolver`. Cause: Corepack downloaded pnpm 12, which blocks dependency
build scripts unless approved; the repo lockfile is v9 (pnpm 9/10 era) and has no
`onlyBuiltDependencies` list.

Fix: [`infra/app/Dockerfile`](../../infra/app/Dockerfile) now pins pnpm 9 via
`corepack prepare pnpm@9.15.4 --activate` in both stages, matching the lockfile format and
avoiding the pnpm 12 build-script approval gate. Rebuild with `docker compose ... up -d --build`.
