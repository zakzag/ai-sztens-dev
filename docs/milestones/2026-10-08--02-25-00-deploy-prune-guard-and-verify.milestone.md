# Deploy prune guard + post-up verify (compose-invisible stray fix)

## Problem / feature

`deploy.sh up dev` died with `Conflict. The container name "/aisztens-monitor-1" is already in use by container 63062cd97afc…`, leaving the droplet dark (api/postgres left in `Created`, caddy never created, monitor running on a stale `docker commit` image). The 01:03 deployer repair session (`docs/history/2026-10-08--01-03-30-deploy-p1-ownership-and-key-provisioning.md`) had manually recreated the monitor container with `docker run` to work around the watch.sh ENOENT bug; the resulting container was missing enough compose labels that `docker compose down --remove-orphans` and `docker compose up` could no longer see it.

## Measured data / evidence

| filter | count | names |
|---|---|---|
| `--filter label=com.docker.compose.project=aisztens` | 3 | api, postgres, monitor |
| `--filter label=com.docker.compose.project=aisztens` AND `--filter label=com.docker.compose.oneoff=False` | 2 | api, postgres |
| `docker compose ps -a` | 2 | api, postgres |

Labels of the blocker `63062cd97afc`:

```
{"com.docker.compose.project":"aisztens",
 "com.docker.compose.service":"monitor",
 "com.docker.compose.version":"5.6.0"}
```

— no `config-hash`, no `oneoff=False`, no `project.working_dir`, no `project.config_files`, no `environment_file`, no `container-number`, no `image`. Compose v5.6.0 lists project containers filtered on `project=…` AND `oneoff=False`, so the blocker is invisible to both `down --remove-orphans` and `up`. Hence the `Conflict`.

## Root cause or design rationale

Two latent gaps combined to make the failure silent and unrecoverable:

1. `prune_legacy_stack` was hiding its own output (`2>/dev/null || true`); a no-op `down` looked identical to a successful one. The 01:22 stray was created during the 01:03 repair but `prune` could not see it, so it stayed — and the next `up` tried to create a duplicate name → conflict.
2. `docker compose up -d --build` exits 0 the moment all containers are **created**, not the moment they are **running**. After the conflict aborted the run, the api/postgres were left in `Created` (caddy was never created). A post-`up` health gate would have caught the partial state on any future regression.

Design choice: do not use a YAML parser. The compose file is ours and the format is fixed; an `awk` that matches `/^  [a-zA-Z0-9_.-]+:[[:space:]]*$/` (top-level 2-space indent, ignoring the 4-space `networks:` field nested inside each service) is enough and survives a future `volumes:`/`networks:` addition at the top level.

## Solution / implementation

| File | Change |
|---|---|
| [`deploy/deploy.sh:805`](../../deploy/deploy.sh:805) | `_resolve_compose_project_name()` — reads `infra/docker-compose.yml`'s `name:` field, falls back to directory name. |
| [`deploy/deploy.sh:825`](../../deploy/deploy.sh:825) | `prune_legacy_stack()` rewritten: log the `down` invocation and exit code; after the existing legacy-prefix `docker rm -f` block, scan `docker ps -a` for `<project>-<service>-<index>` containers that lack `com.docker.compose.oneoff=False` and `docker rm -f` them with a log_warn. Heredoc args shipped via env vars (`REMOTE_PRUNE_*`) because SSH argv splits on space. |
| [`deploy/deploy.sh:905`](../../deploy/deploy.sh:905) | New `verify_up_result()`: parses expected services locally from `infra/docker-compose.yml`, fetches running services from the droplet, collapses newlines (`bash case`'s `*` does not cross `\n`), and aborts with `Not running after up: <missing>` + two diagnose commands if any expected service is not in the running list. |
| [`deploy/deploy.sh:1029`](../../deploy/deploy.sh:1029) | `up` branch calls `verify_up_result` after `up -d --build`. |
| [`infra/monitor/Dockerfile:8`](../../infra/monitor/Dockerfile:8) | Strips CRs from `watch.sh` in the COPY step. The source file's CRLF (Windows checkout) was reintroduced on every rebuild; the tr-strip in the Dockerfile makes the image immune. |
| [`infra/monitor/watch.sh`](../../infra/monitor/watch.sh) | CRLF stripped (`sed -i 's/\r$//'`). |
| [`scripts/test/_deploy-sh-remote-compose-path-test.sh`](../../scripts/test/_deploy-sh-remote-compose-path-test.sh:1) | Sandbox now copies `infra/docker-compose.yml` (was missing). |
| [`scripts/test/_deploy-sh-remote-compose-path-test.sh:303`](../../scripts/test/_deploy-sh-remote-compose-path-test.sh:303) | `test8.runs-bootstrap-remotely` switched from `assert_out` to `assert_log` (ssh stub writes argv to its log file; stdout check could never pass). |
| [`scripts/test/_deploy-sh-remote-compose-path-test.sh:313`](../../scripts/test/_deploy-sh-remote-compose-path-test.sh:313) | New Scenario 10 (6 assertions) — prune stage captured, project name read from compose.yml, all 4 expected services enumerated, missing-services failure path. |

## Outcome and how to verify

- Offline suite went from 45 OK to **52 OK / 0 FAIL** (`scripts/test/_deploy-sh-remote-compose-path-test.sh`).
- Live `wsl bash deploy.sh up dev` ended `02:22:53 exit=0`; log: `compose_verify / docker compose ps --status running: api caddy monitor postgres` then `All expected services are running.`.
- `docker ps -a` shows all four `aisztens-*-1` containers `Up … (healthy)`. Monitor running `/app/watch.sh` (the ENOENT bug is gone — the Dockerfile tr-strip ensures the image always gets LF watch.sh).

To re-verify:

```bash
bash scripts/test/_deploy-sh-remote-compose-path-test.sh   # 52 / 0
wsl bash -c "cd /mnt/e/projects/AI/2026-08-31-ai-sztens-dev && ./deploy/deploy.sh up dev"
ssh deployer@ssh.aisztens.hu 'docker ps -a -f label=com.docker.compose.project=aisztens --format "{{.Names}} {{.Label \"com.docker.compose.oneoff\"}}"'
```

## Follow-ups

- Caddy is currently rate-limited by Let's Encrypt (`HTTP 429 … 5 failed authorizations per identifier per hour`). Not a regression introduced by this change — the cooldown expires 2026-10-08 ~00:34 UTC and the operator can re-run `deploy.sh up dev` to retry the ACME exchange.
- The `EXPECTED` awk in `verify_up_result` matches top-level 2-space-indented keys. A future YAML shape that nests `volumes:` or `networks:` directly inside `services:` (rather than as siblings) would re-trigger the false-positive the 01:58 live run showed ("Expected services: api" only). The comment block in `verify_up_result` already names the trap.
- The legacy-prefix list in `prune_legacy_stack` (`callback-assistant-*`, `aisztens-legacy-*`, `old-stack-*`) still hard-codes the names we know about. Add new prefixes here whenever a new historical project shows up on this droplet.