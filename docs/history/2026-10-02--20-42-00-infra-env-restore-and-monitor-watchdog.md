# Monitor watchdog explained + `infra/.env` diagnosis and restore

**Date:** 2026-10-02 20:42 (Europe/Budapest)
**Author:** debug mode (Zoo)
**Status:** resolved — local `infra/.env` restored from a hash-verified source; **no production change, no code change**

---

## 1. Question A — what does the `monitor` container do?

A single-purpose API watchdog. It serves no traffic, restarts nothing, and exposes no metrics.

| Aspect | Value | Source |
|---|---|---|
| Image | `aisztens/monitor:latest` (Alpine 3.20 + curl + bash) | [`infra/monitor/Dockerfile`](../../infra/monitor/Dockerfile:4) |
| Entrypoint | `/app/watch.sh`, runs as `nobody` | [`infra/monitor/Dockerfile`](../../infra/monitor/Dockerfile:12) |
| Memory / restart | `mem_limit: 32m`, `restart: unless-stopped` | [`infra/docker-compose.yml`](../../infra/docker-compose.yml:145) |
| Ports | none — internal bridge network only | [`infra/docker-compose.yml`](../../infra/docker-compose.yml:161) |
| Own healthcheck | none — `docker compose ps` shows `Up`, never `(healthy)` | [`docs/snapshot-2026-10-01.md`](../snapshot-2026-10-01.md:98) |

Loop behaviour ([`infra/monitor/watch.sh`](../../infra/monitor/watch.sh:36)):

1. `curl -fsS --max-time 10 "$TARGET_URL"`, default `http://api:3000/healthz` ([`watch.sh:14`](../../infra/monitor/watch.sh:14)) — the dedicated liveness route from [`apps/api/src/health/health.controller.ts`](../../apps/api/src/health/health.controller.ts:12), deliberately outside the NestJS `api` global prefix.
2. Success → `failures=0`; if the previous state was `down`, log `API is reachable again` and POST an `up` event ([`watch.sh:38`](../../infra/monitor/watch.sh:38)).
3. Failure → `failures++` and log `API check failed (n/FAIL_THRESHOLD)` ([`watch.sh:46`](../../infra/monitor/watch.sh:46)); at `FAIL_THRESHOLD` (default `2`) consecutive failures with state `up` → state `down` + POST ([`watch.sh:47`](../../infra/monitor/watch.sh:47)).
4. Sleep `INTERVAL_SECONDS` (default `30`) and repeat forever — probe failures never terminate the container.

Payload: `{"event":"down|up","url":...,"state":...,"checked_at":...}` ([`watch.sh:29`](../../infra/monitor/watch.sh:29)); delivery errors are swallowed (`|| true`, [`watch.sh:33`](../../infra/monitor/watch.sh:33)).

**Operational caveat:** `MONITOR_ALERT_WEBHOOK_URL` ships empty ([`infra/.env.example`](../../infra/.env.example:42)), so the default watchdog is log-only. Register a Healthchecks.io ping URL or a Slack/Discord incoming webhook to actually receive alerts.

Usage:

```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml logs -f monitor
docker compose --env-file infra/.env -f infra/docker-compose.yml restart monitor
docker compose --env-file infra/.env -f infra/docker-compose.yml exec monitor \
  sh -c 'curl -fsS http://api:3000/healthz || echo MONITOR FAILED'
```

---

## 2. Question B — what is `infra/.env` for, and why did deploys succeed without it?

`infra/.env` is the **single interpolation source** for [`infra/docker-compose.yml`](../../infra/docker-compose.yml:1), injected via `--env-file infra/.env` in [`deploy/deploy.sh:81`](../../deploy/deploy.sh:81) and in every CI compose step ([`.github/workflows/deploy.yml:190`](../../.github/workflows/deploy.yml:190)).

### Measured evidence

| # | Check | Result |
|---|---|---|
| 1 | `/opt/aisztens/infra/.env` on the droplet | exists — 2721 bytes, `Sep 29 16:24`, `755 root:root`, 54 lines, **0** `change-me` occurrences |
| 2 | `docker compose --env-file <missing> … config --services` | **hard failure**: `couldn't find env file: …`, exit 1 |
| 3 | `E:\…\2026-08-31-ai-sztens-dev-old\infra\.env` | exists, 2721 bytes, `sha256 03060b66687c64bb3e40d3f4f78aca0defdc0c97e3b53083a830f3aa8be988cd` — **identical to the droplet copy** |
| 4 | `infra/.env` in this checkout before the fix | existed but was a raw copy of `infra/.env.example` (48 lines, `change-me-*` placeholders) |
| 5 | `deploy/.env` in this checkout | **missing** → [`deploy.sh:59`](../../deploy/deploy.sh:59) aborts on `HOST="${HOST:?...}"` |
| 6 | `E:\projects\AI\infra\.env` (parent-dir fallback of [`deploy.sh:204`](../../deploy/deploy.sh:204)) | missing |

### Root cause

The deploy never depended on a local `infra/.env` in this checkout:

- **Droplet persistence.** rsync `--delete` explicitly excludes `infra/.env` ([`deploy.sh:183`](../../deploy/deploy.sh:183)) and the SCP step only overwrites when a local source exists ([`deploy.sh:211`](../../deploy/deploy.sh:211)). One successful upload therefore survives every later deploy.
- **CI path.** [`.github/workflows/deploy.yml:65`](../../.github/workflows/deploy.yml:65) renders the file from the `INFRA_ENV` secret inside the runner and pushes it ([`deploy.yml:108`](../../.github/workflows/deploy.yml:108)) — a local file is never required.
- **Local path.** The successful local deploy came from the sibling checkout `…-ai-sztens-dev-old`, whose `infra/.env` is byte-identical to the droplet copy (evidence #3).

### What breaks when the file is absent

- **On the droplet:** every compose invocation fails immediately — `couldn't find env file` (evidence #2). `up`, `down`, `restart`, `ps`, `logs` ([`deploy.sh:304-317`](../../deploy/deploy.sh:304)) and the CI steps at [`deploy.yml:190`](../../.github/workflows/deploy.yml:190) / [`deploy.yml:214`](../../.github/workflows/deploy.yml:214) / [`deploy.yml:248`](../../.github/workflows/deploy.yml:248) all abort. There is no silent default-substitution fallback.
- **Locally:** `deploy.sh up` aborts with the explicit `ERROR: no infra/.env found` at [`deploy.sh:207`](../../deploy/deploy.sh:207). Without the file, `DOMAIN` degrades to `localhost` ([`deploy.sh:71`](../../deploy/deploy.sh:71)) and `ACME_EMAIL` to `admin@localhost` ([`deploy.sh:79`](../../deploy/deploy.sh:79)), which would build the SPAs against `https://api.localhost/api` and render a Caddyfile with `localhost` hosts.
- **If it were replaced by an empty/partial file:** `CORS_ORIGINS` empty makes [`main.ts:23`](../../apps/api/src/main.ts:23) produce an empty list → [`origin: true`](../../apps/api/src/main.ts:28), i.e. **any origin accepted with credentials** (a security regression, not a hard failure); `POSTGRES_PASSWORD` and the three role passwords matter only on a fresh `pgdata` volume; `AISZTENS_DB_PASSWORD` feeds `DATABASE_URL`; `VAPI_WEBHOOK_SECRET` and `MONITOR_ALERT_WEBHOOK_URL` silently lose their effect.

---

## 3. Action taken

1. Confirmed the droplet copy and the old-checkout copy are byte-identical (`sha256 03060b66…e988cd`).
2. `copy /Y` from `E:\projects\AI\2026-08-31-ai-sztens-dev-old\infra\.env` → `E:\projects\AI\2026-08-31-ai-sztens-dev\infra\.env`.
3. Verified the restored file: same `sha256`, 54 lines, **no** `change-me` placeholder, 17 keys present (`DOMAIN`, `ACME_EMAIL`, `API_PORT`, `CORS_ORIGINS`, `VAPI_WEBHOOK_SECRET`, `POSTGRES_*`, `AISZTENS_DB_*`, `TKOVARI_DB_PASSWORD`, `KRAK_DB_PASSWORD`, `MONITOR_*`, `WEB_DIST_PATH`, `ADMIN_DIST_PATH`).

`infra/.env` is gitignored (`.env` rule in [`.gitignore`](../../.gitignore:43)), so this restore is a local-only change; nothing was uploaded to the droplet and no code was touched.

---

## 4. How to verify

```cmd
certutil -hashfile "infra\.env" SHA256
find /c /v "" "infra\.env"          :: expect 54 lines
findstr /C:"change-me" "infra\.env" :: expect no match
```

Remote cross-check (metadata only, values never printed):

```bash
sha256sum /opt/aisztens/infra/.env   # expect 03060b66687c64bb3e40d3f4f78aca0defdc0c97e3b53083a830f3aa8be988cd
stat -c '%s %y %U:%G %a' /opt/aisztens/infra/.env
```

---

## 5. Follow-ups (deliberately not done — awaiting approval)

1. **Placeholder guard in `deploy.sh`.** `upload()` should refuse to push an `infra/.env` containing `change-me` and warn when it falls back to `$REPO_DIR/../infra/.env`. Today a stray `cp infra/.env.example infra/.env` would overwrite the production secrets on the droplet.
2. **Documentation drift, monitor.** [`docs/docker-debug-playbook.md:632`](../docker-debug-playbook.md:632) §2.16 still describes a `wget`-based exit-255 restart loop; the current script uses `curl` in an infinite loop and cannot die that way. [`docs/Specs/Production-Runbook.md:148`](../Specs/Production-Runbook.md:148) verifies the watchdog with `wget` (works via the BusyBox applet, but the image ships `curl`).
3. **Payload field name mismatch.** [`infra/.env.example:40`](../../infra/.env.example:40) documents the field as `status`, while [`watch.sh:29`](../../infra/monitor/watch.sh:29) sends `state`.
4. **Monitor has no healthcheck**, so a dead watchdog loop is invisible in `docker compose ps` (already noted in the 2026-10-01 snapshot).
