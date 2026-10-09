# Deployment — AIsztens droplet

Runbook to take a fresh DigitalOcean droplet (Ubuntu, only `root`, no Docker) to a
running, monitored application. Everything is Docker Compose-based; the mandatory files
live in [`infra/`](../infra) and this directory.

> **Image-based deploy (2026-10-08).** The droplet is now **image-based**: every
> application service is a pre-built image pulled from GHCR, not a build that
> happens on the server. The repo and `pnpm` workspace are not copied to the
> droplet at all. The deploy script ships three small files (compose,
> `infra/.env`, rendered Caddyfile) and runs `docker compose pull && up -d`.
> See [`docs/history/2026-10-08-dockerized-stack-and-image-based-deploy-plan.md`](../docs/history/2026-10-08-dockerized-stack-and-image-based-deploy-plan.md).

## Overview

| Step | Where | What |
|---|---|---|
| 1. Local prep | your machine | Create `deploy/.env.dev`, copy real SSH keys into `deploy/ssh-keys/`, set `GHCR_OWNER` and (if private) `GHCR_PAT` |
| 2. Bootstrap | droplet | [`deploy/bootstrap.sh`](bootstrap.sh): Docker + users + SSH keys + UFW |
| 3. Image registry | GHCR | `.github/workflows/images.yml` builds and pushes the four images; `deploy.yml` pulls them |
| 4. Start | droplet | `docker compose pull && docker compose up -d` (no `--build`) |

> ### How to run the deploy script on Windows
>
> **Never double-click `deploy/deploy.sh`, and never type `deploy/deploy.sh up` in
> PowerShell or cmd.** Windows resolves `.sh` through the Git Bash file association
> (`git-bash.exe --no-cd "%L" %*`), which opens a *new, throwaway* terminal window and
> hands bash a backslash Windows path it cannot resolve:
>
> ```
> E:projectsAI2026-...-devdeploydeploy.sh: command not found
> ```
>
> The window closes before the message can be read, so a failed deploy looks like
> "it did nothing and showed no error". Use one of these instead:
>
> | Shell | Command |
> |---|---|
> | Git Bash / WSL | `./deploy/deploy.sh up dev` |
> | PowerShell / cmd | `bash deploy/deploy.sh up dev` |
> | PowerShell wrapper (**recommended on Windows**) | `.\deploy\deploy.ps1 up dev` |
>
> The wrapper ([`deploy.ps1`](deploy.ps1)) streams output into the *current* console, keeps
> the window open on failure, prints the tail of `deploy/log/latest.log`, and forwards
> `deploy.sh`'s exit code.
>
> Every run is also written to `deploy/log/` — see [section 10](#10-deploy-logs-deploylog).

> ### Deploy target: `dev` or `prod`
>
> The argument after the command selects which environment file is loaded. Only `dev`
> and `prod` are accepted — anything else is a usage error (exit code 2):
>
> | Command | Env file | `APP_ENV` |
> |---|---|---|
> | `./deploy/deploy.sh up` | `deploy/.env.dev` | `dev` (default) |
> | `./deploy/deploy.sh up dev` | `deploy/.env.dev` | `dev` |
> | `./deploy/deploy.sh up prod` | `deploy/.env.prod` | `prod` |
>
> The same target also selects `infra/.env.<target>`, the SPA build mode and the compose
> `--env-file`, so a mistyped target cannot mix dev artefacts into a prod deploy.
>
> `local` is not a deploy target: the local stack is started by
> [`scripts/dev-stack.sh`](../scripts/dev-stack.sh:1), which uses `infra/.env.local`.
>
> There is **no fallback** to a bare `deploy/.env` — it was replaced by the per-target
> files. If you still have one, migrate with `mv deploy/.env deploy/.env.dev`.

## 1. Local preparation

```bash
cp deploy/.env.example deploy/.env.dev    # the dev droplet  -> set HOST (+ SSH_USER, SSH_KEY, users)
cp deploy/.env.example deploy/.env.prod   # the prod droplet -> only once it exists
cp infra/.env.example infra/.env.dev      # set DOMAIN, DB passwords, secrets
```

`deploy/.env.dev` is the default target, so a bare `./deploy/deploy.sh up` uses it. Both
per-target files are gitignored: they hold the droplet address and the SSH key path.

If your private key is not loaded into `ssh-agent` (or you want to pin a specific
key per-droplet to avoid `too many authentication failures` from `IdentitiesOnly`),
set `SSH_KEY=/absolute/path/to/private_key` in the matching `deploy/.env.<target>`. The
deploy script uses `ssh -o IdentitiesOnly=yes`, so only that key is offered — leaving it
empty falls back to the agent + `~/.ssh` defaults.

The `dev` target pins the passphrase-less deploy key
[`deploy/ssh-keys/deploy.private.key`](ssh-keys/deploy.private.key)
(`SSH_KEY=./deploy/ssh-keys/deploy.private.key`, `SSH_USER=deployer`). The GitHub Actions
workflow uses the **same** key through the `DROPLET_SSH_KEY` secret *and* the same
`deployer` account, so the two deploy paths are interchangeable and the key's public half
must be in `/home/deployer/.ssh/authorized_keys` on the droplet (§8.1).

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

**`bootstrap` is the only command that needs a root login** — it installs packages and
creates users. Every other command (`up`, `down`, `restart`, `ps`, `logs`, `upload`) runs
as `deployer`, the same account the GitHub Actions workflow uses. For that one run either
set `SSH_USER=root` in the env file or override it on the command line:

```bash
SSH_USER=root ./deploy/deploy.sh bootstrap      # once, on a fresh droplet
```

`deploy.sh` enforces this: the `bootstrap` command probes `sudo -n true` first and aborts
with that exact command if the configured user has no passwordless sudo. The deploy key's
public half must be authorised for `deployer` on the droplet (§8.1).

> **Ownership of the deploy tree.** `upload()` is an rsync with `--delete` into
> `/opt/aisztens`, so that directory and everything in it must be writable by `deployer`.
> `assert_remote_ready()` probes exactly that before every upload and, when it is not
> writable, aborts with the one-off fix:
>
> ```bash
> ssh -i deploy/ssh-keys/deploy.private.key root@<host> \
>   'mkdir -p /opt/aisztens && chown -R deployer:deployer /opt/aisztens'
> ```
>
> The current dev droplet already passes (a `777` tree), but `777` is world-writable;
> applying the `chown` above is the recommended hardening.

## 3. Start the stack

```bash
./deploy/deploy.sh up
```

This ships the three small files the droplet needs (compose,
`infra/.env` with `IMAGE_TAG` written in, rendered Caddyfile) and runs:

```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml pull
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d --remove-orphans
```

The droplet never builds anything. The images it pulls are produced by
[`.github/workflows/images.yml`](../.github/workflows/images.yml) in CI and
tagged `sha-<short>` + `<env>`.

Services started: `api` (NestJS + Fastify), `web` (nginx serving the public
SPA), `admin` (nginx serving the dashboard SPA), `postgres` (roles created
on first init), `caddy` (TLS + reverse proxy), `monitor` (watchdog polling
`GET /healthz`).

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
droplet is brought up by repeating steps 1–3 with the same `deploy/.env.dev` +
`infra/.env.dev` values. No snapshot or manual steps are required.

## 8. GitHub Actions deploy

After the droplet has been bootstrapped once (steps 1–4 above) and the deploy
key is authorised for the `deployer` user, every merge into the `dev`
branch is deployed to the droplet by
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). A
PR-only workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
runs install + build + lint + unit tests before the merge is allowed in.

### 8.1 Repository secrets and variables

Configure under **Settings → Secrets and variables → Actions**:

| Secret / variable | Value | Notes |
|---|---|---|
| `DROPLET_HOST` (secret) | Droplet public IPv4 or hostname | e.g. `164.92.248.194`. When the prod droplet comes online, a second `DROPLET_HOST_PROD` secret and a per-env matrix step are needed. |
| `DROPLET_SSH_KEY` (secret) | The passphrase-less deploy key — the contents of [`deploy/ssh-keys/deploy.private.key`](ssh-keys/deploy.private.key) (gitignored) | Its **public** half must be in `/home/deployer/.ssh/authorized_keys` on the droplet, because the workflow logs in as `deployer`. The local `deploy.sh` uses the same key **and the same account**. |
| `INFRA_ENV_DEV` (secret) | Full contents of `infra/.env.dev` (multi-line, verbatim) | Renders `infra/.env` on every deploy. The `workflow_dispatch` matrix default picks this for push to `dev`. |
| `INFRA_ENV_PROD` (secret) | Full contents of `infra/.env.prod` (multi-line, verbatim) | Renders `infra/.env` on every deploy. Only consumed when an operator dispatches the workflow with `app_env=prod` against a future prod droplet. |
| `GHCR_OWNER` (variable) | GitHub org/user that owns the image packages | Used to construct the full image reference (`ghcr.io/<GHCR_OWNER>/aisztens-api` etc.). Defaults to `${{ github.repository_owner }}` if unset. |
| `GHCR_PAT` (secret, optional) | PAT with `read:packages` | Only required when the repository is private and the droplet must `docker login ghcr.io` to pull images. |

The `APP_ENV` selector (`dev` / `prod`) is set automatically:

- **`push` to `dev` branch** → no `inputs.app_env` → `APP_ENV=dev` → renders from `INFRA_ENV_DEV` → deploys to the dev droplet.
- **`workflow_dispatch`** → the operator picks `dev` or `prod` from a choice input → `APP_ENV` is set from that pick → the matching secret is rendered.

The push trigger cannot accidentally target prod (the input does not exist for `push`). Prod deploys are gated by the GitHub `production` environment protection rule (recommended: require a manual reviewer on the `prod` deployer before it can run).

### 8.2 What the workflow does

1. Renders `infra/.env` from the matching GitHub Secret (`INFRA_ENV_DEV` for
   `APP_ENV=dev`, `INFRA_ENV_PROD` for `APP_ENV=prod`). The per-env name selects
   *which secret* is rendered, not which path: a droplet hosts one environment, so
   the runtime file is always `infra/.env`. The choice depends on the trigger:
   - `push` to `dev` → `APP_ENV=dev` → renders the `INFRA_ENV_DEV` secret.
   - `workflow_dispatch` with `app_env=prod` → renders `INFRA_ENV_PROD`.
   The render step exports `APP_ENV` for all downstream steps via
   `$GITHUB_ENV`.
2. SCPs the repo (minus `.git`, `node_modules`, build artifacts, the
   `apps/**/.env.{local,dev,prod}` and `infra/.env.{local,dev,prod}` per-env
   files, and `deploy/ssh-keys/`) to `/opt/aisztens` on the droplet.
3. SCPs the rendered `infra/.env` into `/opt/aisztens/infra/` — the exact path every
   `docker compose --env-file` expects, and the same path `deploy.sh` writes.
4. Builds the SPAs against the matching `apps/<app>/.env.${APP_ENV}` via
   the `--mode ${APP_ENV}` flag passed to `pnpm --filter ... build:${APP_ENV}`.
5. SSHes in as `deployer` and runs
   `APP_ENV=${APP_ENV} docker compose --env-file "infra/.env" -f infra/docker-compose.yml up -d --build --remove-orphans`.
6. Waits for the `api` container healthcheck (defined in
   [`infra/docker-compose.yml`](../infra/docker-compose.yml)) to become
   `healthy`.
7. Runs [`scripts/test/stack-smoke.sh`](../scripts/test/stack-smoke.sh)
   against the live deployment. The 4 liveness + 6 cross-service checks are
   documented in [`scripts/README.md`](../scripts/README.md).
8. On failure, dumps the last 500 log lines of every container into the
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
- `DROPLET_SSH_KEY` is the passphrase-less deploy key; it authenticates as
  `deployer` (sudo + docker group, matching the policy in
  [`bootstrap.sh`](bootstrap.sh:67)). Both deploy paths — local `deploy.sh` and CI —
  use it with that account, so a compromise of the key does not hand over a root
  shell (it still needs `sudo`, which asks for a password on this droplet). The key is
  **also** authorised for `root` at the SSH layer: that is how the one-off
  `SSH_USER=root ./deploy/deploy.sh bootstrap` (and the ownership probe's documented
  fix) works. For stricter isolation, restrict the key in `authorized_keys`
  (`from=` / `restrict` / `command=`) and/or `deployer`'s `sudoers`.

## 9. Local development in WSL (Debian)

The droplet setup assumes a public domain and Let's Encrypt; on a local WSL Debian
(NAT network, no public DNS) use the local stack helper instead — its subcommands, the
exact compose invocation and the `docker-compose.local.yml` override (Caddy disabled,
api/postgres published on localhost) are documented in
[`scripts/README.md`](../scripts/README.md).

```bash
# From the repo root.
scripts/dev-stack.sh up
```

Verify:

```bash
curl http://localhost:3000/api
curl http://localhost:3000/api/callback-requests
```

## 10. Deploy logs (`deploy/log/`)

Every run of [`deploy/deploy.sh`](deploy.sh:1) leaves a complete log — not just the script's
own messages, but the output of every command it runs (`pnpm`, `rsync`, `scp`, `ssh`,
`docker compose` over ssh) — written by [`deploy/lib/logger.sh`](lib/logger.sh:1):

| Path | What |
|---|---|
| `deploy/log/deploy-<YYYYmmdd-HHMMSS>-<command>-<target>.log` | one file per run; the newest `DEPLOY_LOG_KEEP` are kept (default 20) |
| `deploy/log/latest.log` | always the newest run — **read this first after a failure** |

The target is part of the file name, so `ls deploy/log/` distinguishes a dev run from a
prod run. Each file opens with a header (command, start time, host, `APP_ENV`, `DOMAIN`,
git revision) and ends with a footer carrying the exit code, the duration and the log
path. The resolved target and the env file that was loaded are recorded in the `config:`
line.

The guard for a missing `HOST` is an explicit, logged check rather than the
`${HOST:?…}` expansion: bash exits on that expansion *before* the `ERR` trap can run, so
nothing would be reported and no log would be written. With the explicit check, even a run
that aborts during configuration parsing leaves a log behind.

```bash
tail -n 50 deploy/log/latest.log        # triage the last run
bash deploy/deploy.sh ps dev --verbose  # re-run with DEBUG lines (log_debug / log_cmd)
bash deploy/deploy.sh ps prod           # the prod droplet (needs deploy/.env.prod)
```

Optional tuning (environment or `deploy/.env.<target>`):

| Variable | Default | Meaning |
|---|---|---|
| `DEPLOY_LOG_LEVEL` | `INFO` | `DEBUG` keeps `log_debug` / `log_cmd` lines |
| `DEPLOY_LOG_KEEP` | `20` | number of finished runs retained on disk |

The log never contains secrets: the selected env file is sourced with `set -a`, and the logger
refuses to start when bash xtrace is enabled (`set -x`), so `bash -x deploy.sh` cannot dump
env values into the file. The logger prints resolved *names* (`APP_ENV`, `DOMAIN`, host)
only.
