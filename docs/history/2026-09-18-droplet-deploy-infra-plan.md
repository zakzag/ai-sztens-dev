# Plan: DigitalOcean Droplet Deploy & Infra Files

- Date: 2026-09-18
- Status: Done
- Scope: Create the mandatory `deploy/` and `infra/` files for the Callback Assistant droplet
  described in [`docs/prompts/2026-09-18-droplet-setup.txt`](../prompts/2026-09-18-droplet-setup.txt).
  No setup automation is required yet — just the reusable files so an identical machine can be
  brought up quickly and reproducibly.

## 1. Goal

Fill the empty [`deploy/`](../../deploy) and [`infra/`](../../infra) directories with the files
needed to run the project on a single DigitalOcean droplet (Ubuntu) where:

- Four SSH users exist: `tkovari` (owner), `krak` (colleague), `aisztens` (app runtime user),
  `deployer` (deploys everything). All authenticate with SSH keys (already existing).
- A PostgreSQL database runs and is reachable with a password by `tkovari`, `krak` and `aisztens`.
- The Node.js (NestJS) API runs continuously, calls external APIs, and receives inbound calls
  from other APIs (e.g. VAPI webhooks).
- A monitor watches the API and alerts when it is down.
- Everything runs in Docker so the config is easy to change.

## 2. Directory Split

| Directory | Responsibility |
|---|---|
| `infra/` | The runtime stack: Docker images, Compose file, Caddy config, Postgres init, monitor. |
| `deploy/` | Host bootstrap + deployment: user/SSH setup, Docker installation, env template, deploy script, runbook. |

## 3. File Set

### `infra/`

| File | Purpose |
|---|---|
| `infra/docker-compose.yml` | Services: `api`, `postgres`, `caddy`, `monitor`; healthchecks, restart policies, volumes, secrets |
| `infra/.env.example` | All environment variables consumed by Compose (domain, DB credentials, CORS, alert webhook) |
| `infra/app/Dockerfile` | Multi-stage build of the pnpm monorepo API (`@callback/api`) using the exact `start:prod` script |
| `infra/app/.dockerignore` | Keeps build context small and avoids sending `node_modules`, `dist`, `.env` |
| `infra/caddy/Caddyfile` | Reverse proxy + TLS: exposes the API origin and (optionally) static frontends |
| `infra/postgres/init/01-roles.sql` | Idempotent role/database creation for `tkovari`, `krak`, `aisztens` with password from env |
| `infra/monitor/Dockerfile` | Minimal image for the watchdog |
| `infra/monitor/watch.sh` | Loops over `GET /api`; on failure (or recovery) sends a webhook notification |

### `deploy/`

| File | Purpose |
|---|---|
| `deploy/bootstrap.sh` | Run once as root on the empty droplet: install Docker + Compose plugin, create users, install SSH keys, create data dirs, configure UFW |
| `deploy/deploy.sh` | Run as `deployer`: upload `infra/`, build and start the stack via `docker compose` |
| `deploy/.env.example` | Deployment-specific variables (host, users, SSH key paths, postgres passwords) |
| `deploy/ssh-keys/` | One `.pub.example` placeholder per user + README; real keys are gitignored |
| `deploy/README.md` | Step-by-step runbook from fresh droplet to running app |

## 4. Key Design Decisions

- **Everything in Docker Compose** so the host only needs Docker; PostgreSQL, API, Caddy and the
  monitor are containers with `restart: unless-stopped`.
- **The API image is built from the repo root context** so the pnpm workspace resolves correctly
  (`apps/*`, `packages/*`). The runtime runs the package's own `start:prod` script, avoiding a
  fragile hard-coded entry point.
- **Postgres credentials are injected via the official image env vars**; the init SQL creates
  roles/databases idempotently (`DO $$ ... $$` guards) and is parameterized through
  `psql`-style variables passed via Compose.
- **Monitoring is a tiny watchdog container** that polls the API's `GET /api` endpoint and posts
  to a configurable webhook (e.g. Healthchecks.io, Slack, Discord) on failure and recovery. It
  complements Docker healthchecks/restart rather than replacing them.
- **Caddy** terminates TLS automatically and proxies `/api/*` (or the `api.` subdomain) to the
  API container; static frontend mounts are documented but optional for the first deploy.
- **SSH keys are never committed**: only `.pub.example` placeholders and a README are in git; the
  bootstrap script expects real `.pub` files supplied locally.

## 5. Out of Scope (for now)

- Full setup automation (Ansible/Terraform/Packer) and image registry CI.
- Database migrations/persistence (the API still uses an in-memory store; Postgres is provisioned
  and ready, not yet wired into NestJS).
- Multi-droplet / load-balanced topology — one droplet as requested.
- Secrets management beyond env files on the host.

## 6. Verification

- `docker compose config` should validate the Compose file without errors after copying
  `infra/.env.example` to `infra/.env`.
- `bash -n deploy/bootstrap.sh` and `bash -n deploy/deploy.sh` should pass.
- `infra/app/Dockerfile` builds from the repo root (`docker build -f infra/app/Dockerfile .`).

## 7. Follow-ups

- Wire the API to PostgreSQL (TypeORM/Prisma + migrations) once persistence is implemented.
- Build and publish the frontend static assets (`apps/web`, `apps/admin`) and mount them into Caddy.
- Add a secrets manager / `.env` handling for production once the droplet count grows.
