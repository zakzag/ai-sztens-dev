# Deployment — AIsztens droplet

Runbook to take a fresh DigitalOcean droplet (Ubuntu, only `root`, no Docker) to a
running, monitored application. Everything is Docker Compose-based; the mandatory files
live in [`infra/`](../infra) and this directory.

> **Image-based deploy (2026-10-08).** The droplet is now **image-based**: every
> application service is a pre-built image pulled from GHCR, not a build that
> happens on the server. The repo and `pnpm` workspace are not copied to the
> droplet at all. The deploy script ships three small files (compose,
> `infra/.env`, rendered Caddyfile) and runs `docker compose pull && up -d`.
> See [`docs/plans/2026-10-08-dockerized-stack-and-image-based-deploy-plan.md`](../docs/plans/2026-10-08-dockerized-stack-and-image-based-deploy-plan.md).

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

From your machine (needs `ssh` + `scp`; on Windows use Git Bash or WSL):

```bash
./deploy/deploy.sh bootstrap
```

`deploy.sh bootstrap` ships **only what bootstrap needs**: the three deploy
files (`docker-compose.yml`, `infra/.env`, `Caddyfile.rendered`) into
`/opt/aisztens/`, the four `deploy/ssh-keys/*.pub` public keys into
`/opt/aisztens/deploy/ssh-keys/`, and then SSHes in as root to run
[`deploy/bootstrap.sh`](bootstrap.sh). The droplet **never receives
application source code** — this is the image-based deploy model; `pnpm`,
`node_modules`, and the repo source stay on the build host / CI runner.

The bootstrap script itself installs Docker Engine + the Compose plugin,
creates the users (`tkovari`, `krak`, `deployer` with sudo; `aisztens` as
app user), installs their SSH keys from the public halves just shipped,
sets the timezone to `Europe/Budapest`, configures a 2 GB swap file, and
`chown`s the deploy tree to `deployer` so the post-bootstrap deploy path
can write it. It leaves UFW off by default (the DO cloud firewall handles
public ingress). The bootstrap is idempotent: safe to re-run.

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

> **Ownership of the deploy tree.** Every `deploy.sh` command except
> `bootstrap` runs as `deployer`, and the three files uploaded by `upload()`
> (`docker-compose.yml`, `infra/.env`, `Caddyfile.rendered`) have to land
> inside `/opt/aisztens/`. `assert_remote_ready()` probes that
> `deployer@<host>` can write the target directory before every upload and,
> when it cannot, aborts with the one-off fix:
>
> ```bash
> ssh -i deploy/ssh-keys/deploy.private.key root@<host> \
>   'mkdir -p /opt/aisztens && chown -R deployer:deployer /opt/aisztens'
> ```
>
> `bootstrap.sh` runs this `chown` automatically when invoked from
> `deploy.sh bootstrap`. If a later deploy ever fails the preflight probe,
> re-run `bootstrap` (it is idempotent) or apply the chown manually.

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
curl https://api.<DOMAIN>/api          # "Hello Beautiful World!" (api greeting)
curl https://api.<DOMAIN>/healthz      # {"status":"oks",...}
curl https://<DOMAIN>/api/callback-requests
```

`api.<DOMAIN>/healthz` returns the build metadata baked into the image at
build time (deploy date + commit hash) so you can confirm which revision is
running. See [`docs/Specs/Production-Runbook.md`](../docs/Specs/Production-Runbook.md)
for the full post-deploy verification checklist.

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
| `DROPLET_HOST` (secret) | Droplet public IPv4 or hostname (the **current** target droplet — currently the dev one) | e.g. `164.92.248.194`. When a second droplet comes online, the workflow's `inputs.app_env` dispatch needs to select the prod host as well as the prod env secret (`DROPLET_HOST` cannot express two; this is a known follow-up when the prod droplet is provisioned). |
| `DROPLET_SSH_KEY` (secret) | The passphrase-less deploy key — the contents of [`deploy/ssh-keys/deploy.private.key`](ssh-keys/deploy.private.key) (gitignored) | Its **public** half must be in `/home/deployer/.ssh/authorized_keys` on the droplet, because the workflow logs in as `deployer`. The local `deploy.sh` uses the same key **and the same account**. |
| `INFRA_ENV_DEV` (secret) | Full contents of `infra/.env.dev` (multi-line, verbatim) | Renders `infra/.env` on every deploy. Picked when `app_env=dev`. |
| `INFRA_ENV_PROD` (secret) | Full contents of `infra/.env.prod` (multi-line, verbatim) | Renders `infra/.env` on every deploy. Picked when `app_env=prod` (i.e. when an operator dispatches the workflow with `app_env=prod` against a future prod droplet). |
| `GHCR_OWNER` (variable) | GitHub org/user that owns the image packages | Used to construct the full image reference (`ghcr.io/<GHCR_OWNER>/aisztens-api` etc.). Defaults to `${{ github.repository_owner }}` if unset. |
| `GHCR_PAT` (secret, optional) | PAT with `read:packages` | Only required when the repository is private and the droplet must `docker login ghcr.io` to pull images. |

The `APP_ENV` selector (`dev` / `prod`) is set automatically:

- **`images.yml` completion on the `dev` branch** (`workflow_run` → `deploy.yml`) → `APP_ENV=dev` → renders from `INFRA_ENV_DEV` → deploys the dev droplet.
- **`images.yml` `workflow_dispatch` with `app_env=prod`** → `APP_ENV=prod` → renders from `INFRA_ENV_PROD` → deploys the prod droplet. The title carries the env, so the deploy workflow can read it from `workflow_run.display_title`.
- **`deploy.yml` `workflow_dispatch`** → the operator picks `dev` or `prod` from a choice input → the matching secret is rendered, the matching image tag is pulled.

The `deploy.yml` `push` trigger is **deliberately absent**: the push runs
`images.yml`, which in turn triggers `deploy.yml` via `workflow_run`. A
direct push trigger raced the image build and tried to pull a sha tag that
did not exist yet. Prod deploys are gated by the GitHub `production`
environment protection rule on the `deploy.yml` job (recommended: require a
manual reviewer on the `prod` deployer before it can run).

### 8.2 What the workflow does

The workflow is image-based: `.github/workflows/images.yml` builds the four
runtime images (`aisztens-api`, `aisztens-web`, `aisztens-admin`,
`aisztens-monitor`) and pushes them to GHCR with an immutable `sha-<short>`
tag (what the droplet pins) and a mutable `<APP_ENV>` tag. This
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) workflow is the
**consumer** of those images — it never builds anything on the droplet.

Steps:

1. **Plan.** A dedicated `plan` job (no secrets, no SSH) calls
   [`.github/scripts/deploy-plan.sh`](../.github/scripts/deploy-plan.sh) and
   exposes `should_deploy | app_env | image_tag | ref` outputs. The decision is
   driven by the event:
   - `workflow_run` (triggered by `images.yml` completion): deploys the env
     the build was made for (`dev` by default; `prod` for a `prod` build) when
     the build succeeded; skips otherwise. The `IMAGE_TAG` is `sha-<short>` of
     `workflow_run.head_sha` (the commit that was actually built — NOT
     `github.sha`, which on `workflow_run` is the default-branch HEAD).
   - `workflow_dispatch`: deploys the env picked by the `app_env` input
     (`dev`/`prod`); the operator may also override `image_tag`. The images
     for that commit must already exist (run `images.yml` first).
2. **Checkout.** Only the small files the droplet needs
   (`.github/scripts`, `infra/docker-compose.yml`, `infra/caddy/Caddyfile`,
   `scripts/test`) are checked out, at the exact commit being deployed.
3. **Resolve secrets.** The per-env secret (`INFRA_ENV_DEV` for `dev`,
   `INFRA_ENV_PROD` for `prod`) is selected by the `app_env` output and written
   to `infra/.env` on the runner. The workflow appends `APP_ENV` /
   `IMAGE_TAG` / `GHCR_OWNER` / `REGISTRY` last; if the secret already
   declared any of those four, `render-infra-env.sh` strips them and warns
   instead of failing.
4. **Render Caddyfile.** `<DOMAIN>` and `<ACME_EMAIL>` placeholders in
   `infra/caddy/Caddyfile` are replaced with the values from the rendered
   `infra/.env`, producing `infra/caddy/Caddyfile.rendered`. The droplet only
   ever sees the rendered file. A defensive grep guarantees no placeholder
   survives into the deployed config.
5. **Ship to droplet.** `appleboy/scp-action` uploads
   `infra/docker-compose.yml`, `infra/.env`, `infra/caddy/Caddyfile.rendered`
   and `scripts/test/` into `/opt/aisztens/` as `deployer`. `infra/.env` lands
   with mode `0644` for scp compatibility (see step 6).
6. **Tighten permissions.** `chmod 600 infra/.env` on the droplet, in its
   own ssh step, before any further step reads it. The compose file and
   Caddyfile carry no secrets, so they stay at the default `0644`.
7. **`docker login ghcr.io`.** Only when `GHCR_PAT` is set (private repo);
   skipped for anonymous pull on public images.
8. **Pull and start.** `docker compose pull` then
   `up -d --remove-orphans --force-recreate`. No `--build`: the droplet has
   no source tree. `--force-recreate` ensures that an updated compose file or
   a sha-pinned image always materialises; without it, containers pinned to
   an old sha can survive a successful pull.
9. **Verify every service is on the right image tag.** Each application
   service (`api`, `web`, `admin`, `monitor`) is checked to report an image
   reference containing `:$IMAGE_TAG`. Postgres and Caddy are exempt
   (postgres is the official image; Caddy uses a floating `caddy:2-alpine`
   tag). Failing here prevents the "stack appears OK but is pinned to an
   old image" class of silent regressions.
10. **Wait for the `api` healthcheck** to become `healthy` (up to ~150 s, far
    more than the `start_period: 60s` documented in `infra/docker-compose.yml`).
11. **Run the smoke suite.** [`scripts/test/stack-smoke.sh`](../scripts/test/stack-smoke.sh)
    against the live deployment. Failure fails the workflow.
12. **On failure, dump container logs.** The last 500 log lines per service
    (200 for `monitor`) are dumped into the workflow run so the operator does
    not need manual SSH for triage.

The push trigger is deliberately absent from this workflow: `images.yml`
reacts to the push and this workflow follows it via `workflow_run`. A direct
`push` trigger raced the image build and tried to pull a sha tag that did
not exist yet. The deploy path and the local `deploy.sh` path do the same
thing — both consume the GHCR images, neither builds anything on the
droplet.

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
