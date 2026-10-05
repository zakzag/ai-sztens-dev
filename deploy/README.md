# Deployment — AIsztens droplet

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
cp deploy/.env.example deploy/.env        # set HOST, SSH_USER, (optionally) SSH_KEY, users
cp infra/.env.example infra/.env          # set DOMAIN, DB passwords, secrets
```

If your private key is not loaded into `ssh-agent` (or you want to pin a specific
key per-droplet to avoid `too many authentication failures` from `IdentitiesOnly`),
set `SSH_KEY=/absolute/path/to/private_key` in `deploy/.env`. The deploy script
uses `ssh -o IdentitiesOnly=yes`, so only that key is offered — leaving it empty
falls back to the agent + `~/.ssh` defaults.

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

This uploads the repository to `/opt/aisztens` and, as root, installs Docker and the
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

## 8. GitHub Actions deploy

After the droplet has been bootstrapped once (steps 1–4 above) and
`deploy/.env` is set to `SSH_USER=deployer`, every merge into the `dev`
branch is deployed to the droplet by
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). A
PR-only workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
runs install + build + lint + unit tests before the merge is allowed in.

### 8.1 Repository secrets

Configure under **Settings → Secrets and variables → Actions**:

| Secret | Value | Notes |
|---|---|---|
| `DROPLET_HOST` | Droplet public IPv4 or hostname | e.g. `164.92.248.194`. Currently a single value; when the prod droplet comes online, a second `DROPLET_HOST_PROD` secret and a per-env matrix step are needed. |
| `DROPLET_SSH_KEY` | Private key matching [`deploy/ssh-keys/deployer.pub`](ssh-keys/deployer.pub) | Installed into `authorized_keys` by [`bootstrap.sh`](bootstrap.sh) |
| `INFRA_ENV_DEV` | Full contents of [`infra/.env.dev`](../infra/.env.example) (multi-line, verbatim) | Renders `infra/.env.dev` on every deploy. The `workflow_dispatch` matrix default picks this for push to `dev`. |
| `INFRA_ENV_PROD` | Full contents of `infra/.env.prod` (multi-line, verbatim) | Renders `infra/.env.prod` on every deploy. Only consumed when an operator dispatches the workflow with `app_env=prod` against a future prod droplet. |

The `APP_ENV` selector (`dev` / `prod`) is set automatically:

- **`push` to `dev` branch** → no `inputs.app_env` → `APP_ENV=dev` → renders from `INFRA_ENV_DEV` → deploys to the dev droplet.
- **`workflow_dispatch`** → the operator picks `dev` or `prod` from a choice input → `APP_ENV` is set from that pick → the matching secret is rendered.

The push trigger cannot accidentally target prod (the input does not exist for `push`). Prod deploys are gated by the GitHub `production` environment protection rule (recommended: require a manual reviewer on the `prod` deployer before it can run).

### 8.2 What the workflow does

1. Renders `infra/.env.${APP_ENV}` from the matching GitHub Secret
   (`INFRA_ENV_DEV` for `APP_ENV=dev`, `INFRA_ENV_PROD` for `APP_ENV=prod`).
   The choice depends on the trigger:
   - `push` to `dev` → `APP_ENV=dev` → renders `infra/.env.dev`.
   - `workflow_dispatch` with `app_env=prod` → renders `infra/.env.prod`.
   The render step exports `APP_ENV` for all downstream steps via
   `$GITHUB_ENV`.
2. SCPs the repo (minus `.git`, `node_modules`, build artifacts, the
   `apps/**/.env.{local,dev,prod}` and `infra/.env.{local,dev,prod}` per-env
   files, and `deploy/ssh-keys/`) to `/opt/aisztens` on the droplet.
3. SCPs the secret-rendered `infra/.env.${APP_ENV}` on top (destination on
   the droplet stays `/opt/aisztens/infra/.env` — the rename applies only
   to the local repo working copy).
4. Builds the SPAs against the matching `apps/<app>/.env.${APP_ENV}` via
   the `--mode ${APP_ENV}` flag passed to `pnpm --filter ... build:${APP_ENV}`.
6. SSHes in as `deployer` and runs
   `APP_ENV=${APP_ENV} docker compose --env-file "infra/.env.${APP_ENV}" -f infra/docker-compose.yml up -d --build --remove-orphans`.
7. Waits for the `api` container healthcheck (defined in
   [`infra/docker-compose.yml`](../infra/docker-compose.yml)) to become
   `healthy`.
8. Runs [`scripts/test/stack-smoke.sh`](../scripts/test/stack-smoke.sh)
   against the live deployment. The same 4 liveness + 6 cross-service
   checks documented in [`scripts/test/README.md`](../scripts/test/README.md).
7. On failure, dumps the last 500 log lines of every container into the
   workflow run so triage doesn't require manual SSH.

### 8.3 Triggering a manual deploy / rollback

The workflow also listens on `workflow_dispatch`, so a maintainer can
re-run a deploy (or roll back by re-pushing the previous commit to `dev`)
from **Actions → Deploy to droplet → Run workflow** without waiting for a
merge. Concurrency is keyed `deploy-droplet` so two deploys cannot race.

### 8.4 Limitations

- There is **no automatic rollback**. If a bad image makes the smoke
  step fail, the previous (still-healthy) containers are replaced by
  compose only for services that were actually recreated — services that
  were not touched by the change keep running. To roll back definitively,
  push the previous commit to `dev` (or rerun the workflow with that
  commit checked out).
- `DROPLET_SSH_KEY` is the deployer key (sudo + docker group, matching
  the policy in [`bootstrap.sh`](bootstrap.sh:67)). For stricter
  isolation, restrict `deployer`'s `sudoers` to `docker compose` and
  `docker` only.

## 9. Local development in WSL (Debian)

The droplet setup assumes a public domain and Let's Encrypt; on a local WSL Debian
(NAT network, no public DNS) use the local helper instead:

```bash
# From the repo root.
scripts/dev-stack.sh up
# Equivalent long form:
#   docker compose --env-file infra/.env.local \
#     -f infra/docker-compose.yml \
#     -f infra/docker-compose.local.yml up -d --build
```

Verify:

```bash
curl http://localhost:3000/api
curl http://localhost:3000/api/callback-requests
```

The `docker-compose.local.yml` override publishes `api` on `localhost:3000` and Postgres on
`localhost:5432`, and disables Caddy via a `never` profile. It is merged explicitly, so the
droplet deployment is unaffected. From Windows PowerShell, `pwsh scripts/dev-stack.ps1 up`
delegates to the same bash script via WSL.
