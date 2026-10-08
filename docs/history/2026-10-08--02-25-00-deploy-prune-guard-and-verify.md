# Deploy guard: detect compose-invisible strays + verify post-up

**Date:** 2026-10-08 02:25 (Europe/Budapest)
**Milestone:** [`../milestones/2026-10-08--02-25-00-deploy-prune-guard-and-verify.milestone.md`](../milestones/2026-10-08--02-25-00-deploy-prune-guard-and-verify.milestone.md)

## Request

`deploy.sh up dev` died with `Conflict. The container name "/aisztens-monitor-1" is already in use by container 63062cd97afc...`, leaving the site dark (api, postgres in `Created`, caddy never created, monitor still running on a stale image).

## Root cause

A `docker run` had been used at 23:02:29Z on 2026-10-07 (during the 01:03 deployer repair session) to recreate `aisztens-monitor-1`. The resulting container carried only the cosmetic compose labels — `project`, `service`, `version` — and was missing `config-hash`, `oneoff=False`, `project.working_dir`, `project.config_files`, `project.environment_file`. Compose v5.6.0 enumerates a project's containers with `label=com.docker.compose.project=aisztens` AND `label=com.docker.compose.oneoff=False`, so the stray was invisible to:

1. `docker compose down --remove-orphans` — could not remove a container it could not see → left behind
2. `docker compose up -d --build` — could not "recreate" what it could not see → decided to create a new one → `Conflict` on the duplicate name → `exit=1`

## Evidence (live droplet)

```
docker ps -a -f label=com.docker.compose.project=aisztens                         → 3 containers
docker ps -a -f label=com.docker.compose.project=aisztens -f label=...oneoff=False → 2 containers (the blocker invisible)
docker compose ps -a                                                                → 2 containers (same)
```

Labels of the blocker vs. the freshly-created api:

| label | blocker (`aisztens-monitor-1`) | fresh (`aisztens-api-1`) |
|---|---|---|
| `com.docker.compose.project` | `aisztens` | `aisztens` |
| `com.docker.compose.service` | `monitor` | `api` |
| `com.docker.compose.oneoff` | _missing_ | `False` |
| `com.docker.compose.config-hash` | _missing_ | `72a2e6…` |
| `com.docker.compose.project.working_dir` | _missing_ | `/opt/aisztens/infra` |

## Changes

| File | Change |
|---|---|
| [`deploy/deploy.sh:805`](../../deploy/deploy.sh:805) | `_resolve_compose_project_name()` — parses `infra/docker-compose.yml`'s `name:` field, falls back to directory name. Centralised so the stray-container guard and the verify step share the same source of truth. |
| [`deploy/deploy.sh:825`](../../deploy/deploy.sh:825) | `prune_legacy_stack()` rewritten to (i) log the down command and its exit code (was hidden behind `2>/dev/null || true` — the exact reason the 01:22 failure went undiagnosed); (ii) scan `docker ps -a` for containers matching `<project>-<service>-<index>` that LACK `com.docker.compose.oneoff=False`, log them at INFO, and `docker rm -f` them; (iii) ship its args to the heredoc as env vars (`REMOTE_PRUNE_*`) — the SSH argv splits multi-word values on whitespace and turned `--env-file infra/.env -f infra/docker-compose.yml` into garbage on the first attempt. |
| [`deploy/deploy.sh:905`](../../deploy/deploy.sh:905) | New `verify_up_result()` — parses `infra/docker-compose.yml` for the expected service list, fetches `docker compose ps --status running --format '{{.Service}}'` from the droplet, collapses newlines to spaces (`bash case`'s `*` does not cross `\n` — silently missed all services on the first attempt), and aborts with `Not running after up: <missing>` if any expected service is not in `running`. |
| [`deploy/deploy.sh:1029`](../../deploy/deploy.sh:1029) | `up` branch calls `verify_up_result` after `up -d --build`. |
| [`infra/monitor/Dockerfile:8`](../../infra/monitor/Dockerfile:8) | Strips CRs from `watch.sh` in the COPY step (`tr -d '\r'`). The 2026-10-02 fix that landed in the operator narrative did the same repair on a freshly committed image, but the source CRLF was still present and the 02:05 rebuild reintroduced it. Now fixed at the build layer. |
| [`infra/monitor/watch.sh`](../../infra/monitor/watch.sh) | CRLF stripped (`sed -i 's/\r$//'`). |
| [`scripts/test/_deploy-sh-remote-compose-path-test.sh`](../../scripts/test/_deploy-sh-remote-compose-path-test.sh:1) | Sandbox now copies `infra/docker-compose.yml` (was missing — verify_up_result silently got zero services and the new `prune` could not resolve the project name). |
| [`scripts/test/_deploy-sh-remote-compose-path-test.sh:303`](../../scripts/test/_deploy-sh-remote-compose-path-test.sh:303) | `test8.runs-bootstrap-remotely` switched from `assert_out` to `assert_log` (the ssh stub only writes argv to its log file; asserting against stdout could never succeed and was a latent bug). |
| [`scripts/test/_deploy-sh-remote-compose-path-test.sh:313`](../../scripts/test/_deploy-sh-remote-compose-path-test.sh:313) | **New Scenario 10** — asserts the prune stage banner, the project-name resolution (`aisztens`), the four expected services, and the verify-lists-the-missing-services failure path. Brings the suite from 45 to 52 assertions. |

## Operator work performed

1. Live diagnosis via the droplet MCP ssh: read the stray container's labels, ran the `docker ps` filter pair above, captured the `--env-file …` shell-quoting artefact from the first attempt's log.
2. Code edits above; offline suite went from 45 OK to **52 OK / 0 FAIL**.
3. Live `wsl bash deploy.sh up dev` ended at `02:22:53` with `exit=0`, `All expected services are running.` `docker ps` shows all four `aisztens-*-1` containers `Up … (healthy)` (api, postgres) / `Up …` (caddy, monitor), full compose labels.

## Verification

```bash
# Offline suite (must pass all 52)
bash scripts/test/_deploy-sh-remote-compose-path-test.sh

# Acceptance on the droplet (already green)
wsl bash -c "cd /mnt/e/projects/AI/2026-08-31-ai-sztens-dev && ./deploy/deploy.sh up dev"
# Expected: prune stage banner captured; "[prune_legacy_stack] no compose-invisible strays";
#           "All expected services are running."; exit=0.

# Confirm no orphan remains
ssh deployer@ssh.aisztens.hu 'docker ps -a -f label=com.docker.compose.project=aisztens --format "{{.Names}} {{.Label \"com.docker.compose.oneoff\"}}"'
```

## Findings / follow-ups

- The old `prune_legacy_stack`'s `2>/dev/null || true` and the missing post-`up` assertion together were a latent double-bug: a no-op down looked identical to a successful one, and `up` exiting 0 with most services in `Created` was never caught. Both closed.
- `verify_up_result` runs `docker compose ps --status running` after `up` exits. If a future deploy adds a service to `infra/docker-compose.yml` but not to the project, the verify reports the gap. The list is parsed locally (`awk`), so the operator can wire a service without touching the droplet.
- The `EXPECTED` parsing accidentally matched `networks:` nested inside a service on the first attempt and stopped after the first service. Fixed by anchoring the indent to exactly 2 spaces (`/^  [a-zA-Z0-9_.-]+:[[:space:]]*$/`). The next operator who adds `volumes:` or `networks:` at the *top* level inside `services:` (YAML-valid) will trip the same pattern — the awk comment names the trap.
- Caddy is currently rate-limited by Let's Encrypt (`HTTP 429 urn:ietf:params:acme:error:rateLimited - too many failed authorizations`). The rate-limit is an external constraint (5 fails per identifier per hour), not a deploy-script regression. The fix above does not change Caddy behaviour; the operator can re-issue the cert after the cooldown.