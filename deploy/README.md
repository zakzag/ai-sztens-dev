# Deployment — Callback Assistant droplet

Runbook to take a fresh DigitalOcean droplet (Ubuntu, only `root`, no Docker) to a
running, monitored application. Everything is Docker Compose-based; the mandatory files
live in [`infra/`](../infra) and this directory.

## Overview

| Step | Where | What |
|---|---|---|
| 1. Local prep | your machine | Create `deploy/.env`, copy real SSH keys into `deploy/ssh-keys/` |
| 2. Bootstrap | droplet | [`deploy/bootstrap.sh`](bootstrap.sh): Docker + users + SSH keys + UFW |
| 3. Runtime config | droplet | `infra/.env` from [`infra/.env.example`](../infra/.env.example) |
| 4. Start | droplet | `docker compose up -d --build` |

## 1. Local preparation

```bash
cp deploy/.env.example deploy/.env        # set HOST, SSH_USER, users
cp infra/.env.example infra/.env          # set DOMAIN, DB passwords, secrets
```

Copy the four public keys next to [`deploy/ssh-keys/README.md`](ssh-keys/README.md):

```
deploy/ssh-keys/tkovari.pub
deploy/ssh-keys/krak.pub
deploy/ssh-keys/aisztens.pub
deploy/ssh-keys/deployer.pub
```

Point DNS `A` records for `DOMAIN` (and `api.DOMAIN`) at the droplet's public IPv4
*before* the first `up`, so Caddy can obtain TLS certificates.

## 2. Bootstrap the droplet

From your machine (needs `ssh` + `rsync`; on Windows use Git Bash or WSL):

```bash
./deploy/deploy.sh bootstrap
```

This uploads the repository to `/opt/callback` and, as root, installs Docker and the
Compose plugin, creates the users (`tkovari`, `krak`, `deployer` with sudo;
`aisztens` as app user), installs their SSH keys, and leaves UFW off by default.

After this step you can switch `deploy/.env` → `SSH_USER=deployer` (or stay on root).

## 3. Start the stack

```bash
./deploy/deploy.sh up
```

This uploads the latest files and runs:

```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d --build
```

Services started: `api` (NestJS + Fastify), `postgres` (roles created on first init),
`caddy` (TLS + reverse proxy), `monitor` (watchdog polling `GET /api`).

## 4. Verify

```bash
./deploy/deploy.sh ps
curl https://api.<DOMAIN>/api          # "Hello World!"
curl https://<DOMAIN>/api/callback-requests
```

Postgres is reachable from the host/droplet shell by any of the three DB users once the
container is up (credentials come from `infra/.env`).

## 5. Day-to-day

```bash
./deploy/deploy.sh logs     # tail all logs
./deploy/deploy.sh restart  # restart the stack
./deploy/deploy.sh down     # stop (volumes are preserved)
```

## 6. Monitoring

The `monitor` container polls `MONITOR_TARGET_URL` every `MONITOR_INTERVAL_SECONDS`.
After `MONITOR_FAIL_THRESHOLD` consecutive failures it POSTs a `{"event":"down",...}`
payload to `MONITOR_ALERT_WEBHOOK_URL`, and a `{"event":"up",...}` payload on recovery.
Point that URL at Healthchecks.io, a Slack incoming webhook, or Discord.

## 7. Reproducing an identical machine

Because the bootstrap script and the Compose stack are declarative and idempotent, a new
droplet is brought up by repeating steps 1–3 with the same `deploy/.env` +
`infra/.env` values. No snapshot or manual steps are required.

## 8. Local development in WSL (Debian)

The droplet setup assumes a public domain and Let's Encrypt; on a local WSL Debian
(NAT network, no public DNS) use the local override instead:

```bash
# 1. Install Docker: either Docker Desktop for Windows with WSL integration,
#    or native Docker inside WSL (enable systemd first, then get.docker.com).
# 2. Prepare the env file.
cp infra/.env.example infra/.env

# 3. Start without Caddy/TLS; the API is reachable at http://localhost:3000/api.
docker compose --env-file infra/.env \
  -f infra/docker-compose.yml \
  -f infra/docker-compose.wsl.yml up -d --build
```

Verify:

```bash
curl http://localhost:3000/api
curl http://localhost:3000/api/callback-requests
```

The `docker-compose.wsl.yml` override publishes `api` on `localhost:3000` and Postgres on
`localhost:5432`, and disables Caddy via a `never` profile. It is merged explicitly, so the
droplet deployment is unaffected.
