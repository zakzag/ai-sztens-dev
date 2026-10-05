## Summary

The `monitor` service is a lightweight **API liveness watchdog** — an Alpine + curl container ([`infra/monitor/Dockerfile`](infra/monitor/Dockerfile:4)) that runs [`infra/monitor/watch.sh`](infra/monitor/watch.sh:1) forever, polls the API's `/healthz` route, and posts an alert webhook when the API crosses the failure threshold or recovers. It has no published ports, no own healthcheck, a 32 MB memory cap and `restart: unless-stopped` ([`infra/docker-compose.yml`](infra/docker-compose.yml:140)).

### Behaviour

| Step | Detail |
|---|---|
| Target | `MONITOR_TARGET_URL`, default `http://api:3000/healthz` ([`watch.sh:14`](infra/monitor/watch.sh:14)) — the dedicated liveness route from [`apps/api/src/health/health.controller.ts`](apps/api/src/health/health.controller.ts:12), outside the NestJS `api` prefix |
| Poll | `curl -fsS --max-time 10`, every `INTERVAL_SECONDS` (30 s) |
| Failure path | counter increments, log `API check failed (n/FAIL_THRESHOLD)`; at `FAIL_THRESHOLD` (2) consecutive failures with prior state `up` → state `down` + webhook POST ([`watch.sh:47`](infra/monitor/watch.sh:47)) |
| Recovery path | counter reset; if state was `down` → log `API is reachable again` + `up` webhook ([`watch.sh:38`](infra/monitor/watch.sh:38)) |
| Never exits | infinite `while true` loop → the container stays `Up`; probe failures never terminate it |
| Payload | `{"event":"down\|up","url":...,"state":...,"checked_at":...}` ([`watch.sh:29`](infra/monitor/watch.sh:29)); webhook errors swallowed via `|| true` ([`watch.sh:33`](infra/monitor/watch.sh:33)) |

**Key caveat:** `MONITOR_ALERT_WEBHOOK_URL` is empty by default ([`infra/.env.example`](infra/.env.example:42)), so out of the box the watchdog is **log-only** — set it to a Healthchecks.io ping URL or a Slack/Discord incoming webhook to actually receive alerts.

### Usage

```bash
# up (monitor builds from ./monitor)
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d --build

# follow ticks
docker compose --env-file infra/.env -f infra/docker-compose.yml logs -f monitor

# restart just the watchdog once the api is healthy
docker compose --env-file infra/.env -f infra/docker-compose.yml restart monitor

# prove the watchdog can reach the API from inside its container
docker compose --env-file infra/.env -f infra/docker-compose.yml exec monitor \
  sh -c 'curl -fsS http://api:3000/healthz || echo MONITOR FAILED'

# exercise the alert path
docker compose --env-file infra/.env -f infra/docker-compose.yml stop api   # wait ~60s
docker compose --env-file infra/.env -f infra/docker-compose.yml logs --tail=20 monitor
docker compose --env-file infra/.env -f infra/docker-compose.yml start api
```

Config knobs: `MONITOR_TARGET_URL` (default `http://api:3000/healthz`), `MONITOR_INTERVAL_SECONDS` (`30`), `MONITOR_FAIL_THRESHOLD` (`2`, compose default only — not present in [`infra/.env.example`](infra/.env.example:33)), `MONITOR_ALERT_WEBHOOK_URL` (empty). Locally it is covered by [`scripts/test/stack-up.sh`](scripts/test/stack-up.sh:1) + the log-scan assertion in [`scripts/test/README.md`](scripts/test/README.md:42).

### Diagnosed documentation drift (reported, not changed)

1. [`docs/docker-debug-playbook.md`](docs/docker-debug-playbook.md:632) §2.16 still attributes a `Restarting (255)` cycle to `wget` exiting non-zero and "the shell exited". The current script uses `curl` inside an infinite loop with `set -u` only (no `set -e`), so a probe failure cannot terminate the container. The remediation commands in that section remain valid; the root-cause text is stale.
2. [`docs/Specs/Production-Runbook.md`](docs/Specs/Production-Runbook.md:148) verifies the watchdog with `wget` and [`infra/.env.example`](infra/.env.example:40) documents the payload field as `status`, whereas [`watch.sh:29`](infra/monitor/watch.sh:29) emits `state` and the image's own HTTP client is `curl`. The `wget` command still works (BusyBox applet), but the docs no longer match the implementation.

Fixing these three doc references requires your confirmation before I edit them, since the current request was informational.