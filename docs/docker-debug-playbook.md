# Docker Debug Playbook — AIsztens

A scenario-driven, copy-paste-ready playbook for debugging the AIsztens
production stack ([`infra/docker-compose.yml`](../infra/docker-compose.yml):
`api`, `postgres`, `caddy`, `monitor`) and the droplet that hosts it.

The scenarios below are **not theoretical**: every one of them maps to a
real incident that already happened on `ssh.aisztens.hu`. The history files
are linked for the curious; this playbook is the fast path to resolution.

> **How to use this file:** jump to the symptom you see in §2, follow the
> "Then do this" steps verbatim, and only consult §3 if you need the
> underlying tool reference. The §4 escalation bundle will hand a clean
> snapshot of the system to anyone helping you.

---

## Table of contents

1. [Start here: first 60 seconds](#1-start-here-first-60-seconds)
2. [Scenario playbook (symptom → diagnosis → fix)](#2-scenario-playbook-symptom--diagnosis--fix)
   - 2.1 [Container shows `Restarting (1)` in `docker ps`](#21-container-shows-restarting-1-in-docker-ps)
   - 2.2 [API exits with `Exited (137)` (OOM-killed)](#22-api-exits-with-exited-137-oom-killed)
   - 2.3 [`pnpm-native` dominates `top` at 60 %+ CPU](#23-pnpm-native-dominates-top-at-60--cpu)
   - 2.4 [Caddy container is in a restart loop](#24-caddy-container-is-in-a-restart-loop)
   - 2.5 [`docker compose ps` shows only postgres; the rest are `Created`](#25-docker-compose-ps-shows-only-postgres-the-rest-are-created)
   - 2.6 [API container cannot reach Postgres](#26-api-container-cannot-reach-postgres)
   - 2.7 [`https://api.<DOMAIN>/healthz` returns 502 / 503 / 504](#27-httpsapipdomainhealthz-returns-502--503--504)
   - 2.8 [Container exposes no host port / `curl localhost:5432` fails](#28-container-exposes-no-host-port--curl-localhost5432-fails)
   - 2.9 [Healthcheck logs show `exitCode: 1` continuously](#29-healthcheck-logs-show-exitcode-1-continuously)
   - 2.10 [`docker compose up` fails: `couldn't find env file`](#210-docker-compose-up-fails-couldnt-find-env-file)
   - 2.11 [TLS handshake error: `internal error (592)` from Caddy](#211-tls-handshake-error-internal-error-592-from-caddy)
   - 2.12 [`ERR_CONNECTION_TIMED_OUT` from the browser, but `curl` works on the droplet](#212-err_connection_timed_out-from-the-browser-but-curl-works-on-the-droplet)
   - 2.13 [ACME logs: `Timeout during connect (likely firewall problem)`](#213-acme-logs-timeout-during-connect-likely-firewall-problem)
   - 2.14 [SPA subdomains return 404 / `ERR_FILE_NOT_FOUND`](#214-spa-subdomains-return-404--err_file_not_found)
   - 2.15 [`dmesg` shows `Memory cgroup out of memory: Killed process ...`](#215-dmesg-shows-memory-cgroup-out-of-memory-killed-process-)
   - 2.16 [`monitor` container `Restarting (255)` after deploy](#216-monitor-container-restarting-255-after-deploy)
   - 2.17 [Disk fills up (`No space left on device` in build/pull)](#217-disk-fills-up-no-space-left-on-device-in-buildpull)
   - 2.18 [`deploy.sh` rsync fails with `bash: line 1: <host>: command not found`](#218-deploysh-rsync-fails-with-bash-line-1-host-command-not-found)
   - 2.19 [Build emits `useradd warning: ... uid is greater than SYS_UID_MAX`](#219-build-emits-useradd-warning--uid-is-greater-than-sys_uid_max)
3. [Tool reference (the toolbox behind the playbook)](#3-tool-reference-the-toolbox-behind-the-playbook)
4. [Escalation: produce a debug bundle in one command](#4-escalation-produce-a-debug-bundle-in-one-command)
5. [Source-of-truth links](#5-source-of-truth-links)

---

## 1. Start here: first 60 seconds

Run these in order. Most symptoms in §2 are diagnosed by combinations of
the first three commands.

```bash
# Where am I? (droplet vs local)
pwd && cat /etc/hostname                # droplet: ssh.aisztens.hu

# Move to the project root if you are on the droplet
cd /opt/aisztens || cd "$(git rev-parse --show-toplevel)"

# 1. Container state — include Created/Exited with -a
docker compose -f infra/docker-compose.yml ps -a

# 2. Last 100 log lines per service, timestamps on
docker compose -f infra/docker-compose.yml logs --tail=100 -t

# 3. Live resource snapshot (RSS / CPU / I/O)
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}'

# 4. Host load + memory + swap (host vs container — see §2.3)
uptime && free -h && vmstat 1 3
```

If a container is in `Restarting` / `Exited` / `OOMKilled`, jump straight
to the matching subsection in §2 with its name in hand.

> **Memory aid:** if you remember nothing else, remember this:
> `docker compose ps -a && docker compose logs --tail=200 -t <service>`.
> These two commands resolve ~80 % of every incident we have logged.

---

## 2. Scenario playbook (symptom → diagnosis → fix)

### 2.1 Container shows `Restarting (1)` in `docker ps`

**What it means:** the main process inside the container exited with
non-zero and `restart: unless-stopped` is bringing it back. Docker prints
the cycle as `Restarting (N) X seconds ago`.

**Then do this:**

```bash
# 1. Why did it exit?  Last 200 lines, then filter for errors.
docker logs --tail=200 aisztens-<service>-1 2>&1 | tail -100
docker inspect aisztens-<service>-1 --format '{{.State.ExitCode}} {{.State.OOMKilled}} {{.State.Error}}'

# 2. If exit code is 137 -> go to §2.2 (OOM-killed).
#    If exit code is 1   -> read the log; usually NestJS / pnpm / Caddy crash.
#    If exit code is 128 -> Caddy could not bind a port; go to §2.4.

# 3. Check the cgroup memory cgroup for failures
dmesg --since '-1h' | grep -i 'killed process' | tail -40
# (Requires root / sudo on the droplet.)
```

**Most common causes in this stack:**

| Service | Typical root cause | Jump to |
|---|---|---|
| `aisztens-api-1` | NestJS not yet listening + short `start_period`; or `/healthz` route missing | [§2.9](#29-healthcheck-logs-show-exitcode-1-continuously) |
| `aisztens-api-1` | `pnpm-native` lockfile-verify OOM at cold start | [§2.3](#23-pnpm-native-dominates-top-at-60--cpu) |
| `aisztens-caddy-1` | Unrendered `<DOMAIN>` placeholder in Caddyfile | [§2.4](#24-caddy-container-is-in-a-restart-loop) |
| `aisztens-caddy-1` | Two Caddy containers fighting over 80/443 | [§2.4b](#two-caddy-containers-fight-over-80443) |
| `aisztens-caddy-1` | ACME challenge failed (firewall / DNS) | [§2.13](#213-acme-logs-timeout-during-connect-likely-firewall-problem) |
| `aisztens-monitor-1` | `wget` returns non-zero on first probe before `api` is up | [§2.16](#216-monitor-container-restarting-255-after-deploy) |

Source incidents: [`history/2026-09-29--00-30-10-api-healthcheck-fail-plan.md`](history/2026-09-29--00-30-10-api-healthcheck-fail-plan.md), [`history/2026-09-28--13-35-06-caddy-restart-loop-and-mem-limits.milestone.md`](milestones/2026-09-28--13-35-06-caddy-restart-loop-and-mem-limits.milestone.md).

---

### 2.2 API exits with `Exited (137)` (OOM-killed)

**What it means:** the kernel sent `SIGKILL` to the container's main
process because the cgroup exceeded `mem_limit`. The Node process did
nothing wrong — the cgroup ran out of RSS.

**Then do this:**

```bash
# 1. Confirm the OOM via the kernel ring buffer (requires sudo)
sudo dmesg --since '-1h' | grep -E 'Killed process.*(node|pnpm)' | tail -20

# 2. What is the current limit?
docker inspect aisztens-api-1 --format '{{.HostConfig.Memory}}'
# Expect: 419430400 (400 MB), see infra/docker-compose.yml.

# 3. Is V8 the culprit? (will hit --max-old-space-size before the cgroup limit)
docker logs --tail=200 aisztens-api-1 | grep -E 'heap out of memory|Reached heap limit'

# 4. Was it a steady leak or a spike?  CPU/RSS over time:
docker stats --no-stream aisztens-api-1
```

**Fix ladder (do them in this order):**

1. **Burst (lockfile-verify on cold start).** Symptom: dies within the
   first 90 s of a deploy, `pnpm-native` appears in `dmesg`. Fix:
   [§2.3](#23-pnpm-native-dominates-top-at-60--cpu) — make the runtime
   image skip the pnpm wrapper.
2. **Steady-state V8 leak.** Symptom: container ages → RSS creeps → kills.
   Fix: `docker compose exec api node --inspect=0.0.0.0:9229 dist/main.js`,
   take a heap snapshot from Chrome (`chrome://inspect`), find the
   retaining object. Alternatively, set
   `NODE_OPTIONS=--max-old-space-size=384` so V8 throws
   `JavaScript heap out of memory` **before** the cgroup does, and the
   log will name the offending allocation.
3. **Wrong `mem_limit`.** Bump the limit only after (1) and (2) are ruled
   out, and only after `free -h` on the host confirms the headroom.
   Bumping a limit without understanding the leak is how the host
   itself ends up in swap-thrash — see
   [`history/2026-09-27--01-17-25-container-mem-limits-after-oom-plan.md`](history/2026-09-27--01-17-25-container-mem-limits-after-oom-plan.md).

Source: [`history/2026-09-29--00-50-12-pnpm-native-oom-restart-loop-plan.md`](history/2026-09-29--00-50-12-pnpm-native-oom-restart-loop-plan.md).

---

### 2.3 `pnpm-native` dominates `top` at 60 %+ CPU

**What it means:** almost certainly **not** a host process. On DigitalOcean
droplets the `do-agent` user owns a Rust helper called `pnpm-native`. In
`top` it is the *container's* PID namespace, not the host's. (The actual
GitHub-Actions runner that produced `pnpm-native` lives on a different
machine.)

If `ps -eo user,comm | grep pnpm-native` returns rows for **a container's
PID**, then yes — your container is genuinely running the helper.

**Then do this:**

```bash
# 1. Whose PID is it really?
docker top aisztens-api-1 -o pid,user,pcpu,pmem,comm
# If pid 1 is `pnpm` or `node /usr/local/bin/pnpm`, the runtime image is
# using the pnpm wrapper.  That is the bug.

# 2. What is pnpm doing?
docker logs --tail=200 aisztens-api-1 | grep -E 'Verifying lockfile|Progress: resolved|Re-verifying'
# If you see 'Verifying lockfile against supply-chain policies (741 entries)...'
# repeating every restart, pnpm-native is the culprit.

# 3. Did the kernel kill it?
sudo dmesg --since '-1h' | grep -E 'Killed process.*pnpm-native|anon-rss:3[0-9][0-9]'
```

**Fix.** The runtime stage must **not** invoke the pnpm wrapper. Change
[`infra/app/Dockerfile`](../infra/app/Dockerfile):

```diff
-CMD ["pnpm", "--filter", "@callback/api", "start:prod"]
+CMD ["node", "apps/api/dist/main.js"]
```

The `pnpm install --frozen-lockfile` and `pnpm --filter @callback/api build`
already ran in the **build stage**, so the runtime image has a complete
`node_modules` and a compiled `dist/`. We bypass the wrapper that does the
expensive lockfile-verify on every cold start.

After editing, rebuild on the droplet:

```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d --build api
docker logs --tail=50 aisztens-api-1 | head -40    # confirm Node starts
```

Source: [`history/2026-09-29--00-50-12-pnpm-native-oom-restart-loop-plan.md`](history/2026-09-29--00-50-12-pnpm-native-oom-restart-loop-plan.md).

---

### 2.4 Caddy container is a restart loop

Three flavours hit us historically. Diagnose from the **log line**, not
the exit code.

```bash
docker logs --tail=100 aisztens-caddy-1 2>&1 | tail -40
```

#### 2.4a `subject does not qualify for certificate: '<DOMAIN>'`

The rendered Caddyfile still contains an unsubstituted placeholder. The
**template** uses `<DOMAIN>` and `<ACME_EMAIL>`; if the rendered file
mounts the template by mistake, every boot crashes here.

**Then do this:**

```bash
# 1. Is the placeholder in the rendered file?
grep -E '<DOMAIN>|<ACME_EMAIL>' /opt/aisztens/infra/caddy/Caddyfile.rendered
# Expect: empty.

# 2. What does the container actually see?
docker compose exec caddy cat /etc/caddy/Caddyfile | grep -E '<DOMAIN>|<ACME_EMAIL>'
# Expect: empty.

# 3. If either has matches, re-render from the template:
DOMAIN=aisztens.hu ACME_EMAIL=admin@aisztens.hu \
  sed -e "s|<DOMAIN>|$DOMAIN|g" -e "s|<ACME_EMAIL>|$ACME_EMAIL|g" \
    /opt/aisztens/infra/caddy/Caddyfile \
    > /opt/aisztens/infra/caddy/Caddyfile.rendered

docker compose --env-file infra/.env -f infra/docker-compose.yml restart caddy
```

Source: [`milestones/2026-09-28--13-35-06-caddy-restart-loop-and-mem-limits.milestone.md`](milestones/2026-09-28--13-35-06-caddy-restart-loop-and-mem-limits.milestone.md).

#### 2.4b `Bind for 0.0.0.0:80 failed: port is already allocated`

**Then do this:**

```bash
# 1. What is binding host 80 / 443 right now?
sudo ss -tlnp | grep -E ':(80|443)\b'

# 2. Are there TWO Caddy containers alive?
docker ps -a --filter ancestor=caddy
docker ps -a --filter 'name=caddy'

# 3. If two stacks (e.g. aisztens-* AND callback-assistant-*) co-exist,
#    kill the orphan:
docker rm -f callback-assistant-caddy-1
docker network rm callback-assistant_internal || true
docker volume rm callback-assistant_caddy_config callback-assistant_caddy_data || true

# 4. Restart the canonical stack:
cd /opt/aisztens && docker compose --env-file infra/.env -f infra/docker-compose.yml up -d
```

Defence: [`deploy/deploy.sh:prune_legacy_stack()`](../deploy/deploy.sh) runs
on every `up` and removes the legacy project; a single Caddy container is
the documented rule.

Source: [`history/2026-09-29--00-06-14-dual-stack-port-collision-fix-plan.md`](history/2026-09-29--00-06-14-dual-stack-port-collision-fix-plan.md).

#### 2.4c `lookup ... 127.0.0.53:53: read: connection refused`

The Docker bridge cannot reach systemd-resolved. ACME DNS lookups fail
before any HTTP listener starts.

**Then do this:**

```bash
# Quick local fix inside the container (testing only)
docker compose exec caddy sh -c 'echo "nameserver 1.1.1.1" > /etc/resolv.conf'

# Permanent fix in compose (already merged in infra/docker-compose.yml):
#   caddy:
#     dns:
#       - 1.1.1.1
#       - 8.8.8.8
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d caddy
```

Source: [`history/2026-09-29--00-18-17-dual-stack-port-collision-fix-impl.md`](history/2026-09-29--00-18-17-dual-stack-port-collision-fix-impl.md).

#### 2.4d `open /srv/web: no such file or directory`

The SPA dist folders do not exist on the droplet. Go to [§2.14](#214-spa-subdomains-return-404--err_file_not_found).

---

### 2.5 `docker compose ps` shows only postgres; the rest are `Created`

**What it means:** the last `docker compose up -d --build` was
interrupted (network glitch, SSH drop, timeout), so containers were
**created** but never **started**. `docker compose ps` (without `-a`)
hides `Created` containers — that is why "only postgres" is visible.

**Then do this:**

```bash
# 1. Show EVERY container, including stopped / created
docker compose --env-file infra/.env -f infra/docker-compose.yml ps -a

# 2. Start whatever is Created / Exited
cd /opt/aisztens
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d --build

# 3. Verify
docker compose --env-file infra/.env -f infra/docker-compose.yml ps -a
```

**Lesson:** **`docker compose ps` alone is never enough.** Always use
`ps -a`. The lesson is now baked into the
[Production Runbook §4.1](Specs/Production-Runbook.md#41-konténerek-állapota--a-created--up-csapda).

Source: [`history/2026-09-28--19-22-51-production-runbook-and-docker-compose-ps-gotcha.md`](history/2026-09-28--19-22-51-production-runbook-and-docker-compose-ps-gotcha.md).

---

### 2.6 API container cannot reach Postgres

**Symptoms in API logs:** `ECONNREFUSED 127.0.0.1:5432`, `getaddrinfo ENOTFOUND postgres`,
`password authentication failed for user "aisztens"`.

**Then do this:**

```bash
# 1. Are api and postgres on the same network?
docker network inspect aisztens_internal \
  --format '{{range .Containers}}{{.Name}} {{end}}'
# Expect: aisztens-api-1 aisztens-postgres-1 aisztens-caddy-1 aisztens-monitor-1

# 2. Can api resolve 'postgres' as a hostname?
docker compose exec api getent hosts postgres
# Alpine image — if 'nslookup'/'getent' missing:
docker compose exec api wget -qO- http://postgres:5432 || echo "tcp OK"

# 3. Does postgres actually accept connections?
docker compose exec postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-callback}"

# 4. Is the DATABASE_URL correct?
docker compose exec api env | grep -E 'DATABASE_URL|POSTGRES'
# MUST contain 'postgres:5432', never '127.0.0.1' or 'localhost'.
```

**Common root causes:**

| Root cause | Symptom | Fix |
|---|---|---|
| `DATABASE_URL=postgres://...@localhost:5432/...` in `infra/.env` | `ECONNREFUSED 127.0.0.1:5432` | Change to `@postgres:5432`, redeploy. |
| `AISZTENS_DB_PASSWORD` empty / placeholder in `infra/.env` | `password authentication failed for user "aisztens"` | Fill in the password; rerun `postgres/init/01-roles.sh` only on a fresh volume. |
| `depends_on: postgres: condition: service_healthy` failed | api never gets `service_started` until postgres is `healthy` | Wait for `pg_isready` to return; if it loops, check the password envs. |
| Two api replicas, one healthcheck-race | Random `ECONNREFUSED` during deploy | This stack has 1 replica per service — if you scale it, stop. |

Source: [`docker-compose.yml`](../infra/docker-compose.yml) (DATABASE_URL), [`history/2026-09-29--00-30-10-api-healthcheck-fail-plan.md`](history/2026-09-29--00-30-10-api-healthcheck-fail-plan.md) §3.

---

### 2.7 `https://api.<DOMAIN>/healthz` returns 502 / 503 / 504

**What it means:** Caddy is up, but cannot reach the upstream `api:3000`.
The 502/503/504 is Caddy's "upstream failed" code.

**Then do this:**

```bash
# 1. Confirm Caddy is up
docker ps --filter 'name=caddy' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

# 2. Confirm api is up AND on the same network
docker ps --filter 'name=api' --format 'table {{.Names}}\t{{.Status}}'
docker network inspect aisztens_internal --format '{{range .Containers}}{{.Name}} {{end}}'

# 3. Test the upstream DIRECTLY from inside the Caddy container
docker compose exec caddy wget -qO- http://api:3000/healthz || echo FAIL
# Expect: {"status":"ok",...}

# 4. Test from your local machine on the droplet
curl -fsS http://127.0.0.1:3000/healthz || echo FAIL
# If this fails: api is not listening.  Check its log.

# 5. Inspect the Caddy log for the failure code
docker logs --tail=100 aisztens-caddy-1 | grep -E '502|503|504|upstream|dial'
```

**Common root causes:**

- api is in restart loop → Caddy cannot connect → 502. Fix api first
  ([§2.1](#21-container-shows-restarting-1-in-docker-ps)).
- api was redeployed and is still inside `start_period: 60s` → Caddy
  gets connection refused briefly. Wait, or raise the timeout.
- The Caddyfile's `reverse_proxy api:3000` resolves the name through the
  `internal` network. If a manual `docker network disconnect` was ever
  run, the name no longer resolves. Reconnect:
  `docker network connect aisztens_internal aisztens-api-1`.

Source: [`Specs/Caddy-Reverse-Proxy.md`](Specs/Caddy-Reverse-Proxy.md).

---

### 2.8 Container exposes no host port / `curl localhost:5432` fails

**What it means:** the service is reachable from inside the `internal`
network (compose DNS name), but NOT from the host. That is **by design**
for `api` and `postgres` — they use `expose:` not `ports:` in
[`infra/docker-compose.yml`](../infra/docker-compose.yml).

| Service | Host port published? | How to reach from the host |
|---|---|---|
| `caddy` | **Yes** — `80:80`, `443:443` | `curl http://127.0.0.1/` (HTTP→HTTPS) |
| `api` | No (`expose: 3000`) | only via Caddy. For debugging: `docker compose exec caddy wget -qO- http://api:3000/healthz` |
| `postgres` | No (`expose: 5432`) | only from api/monitor. For debugging: `docker compose exec postgres psql ...` |
| `monitor` | No | only via its own log |

**If you genuinely need a host port** (e.g. running psql from your dev
machine against the droplet), do this **only temporarily**:

```bash
# Temporarily publish postgres on host:5432 (REMOVE the rule after debugging!)
docker run --rm -it --name debug-psql \
  --network aisztens_internal \
  -e PGPASSWORD="${AISZTENS_DB_PASSWORD}" \
  postgres:16-alpine psql -h postgres -U aisztens -d callback

# Or, if you must bind to the host directly, edit docker-compose.yml:
#   postgres:
#     ports:
#       - "127.0.0.1:5432:5432"
# then `docker compose up -d --no-deps postgres`. NEVER use "0.0.0.0:5432".
```

If the production Caddy has nothing in the `PORTS` column on `docker ps`,
go to [§2.4b](#24b-bind-for-000080-failed-port-is-already-allocated).

---

### 2.9 Healthcheck logs show `exitCode: 1` continuously

**Then do this:**

```bash
# 1. Read the actual healthcheck history
docker inspect aisztens-api-1 --format '{{json .State.Health}}' | jq .
# Look at .Log[-1].Output — that's what the probe last saw.

# 2. Is the endpoint reachable from inside?
docker compose exec api wget -qO- http://127.0.0.1:3000/healthz
# Expect: {"status":"ok",...}
# If 404: the route is missing -> see below.

# 3. Is the route prefix-stripped?
grep -n "setGlobalPrefix" apps/api/src/main.ts
# Expect: app.setGlobalPrefix('api', { exclude: ['healthz'] })
# If 'healthz' is missing from the exclude list, the route is /api/healthz,
# not /healthz, and the probe is calling the wrong URL.
```

**Two common root causes (both seen in the field):**

1. **Wrong URL.** `/api/healthz` is a 404 because the global prefix is
   `api` and `healthz` is not excluded. Fix: add `healthz` to the
   `exclude` array in `setGlobalPrefix`.
2. **Cold start longer than `start_period: 60s`.** Symptom: the NestJS
   process IS running but the first requests hang in `pnpm install`
   warm-up. Fix: bump `start_period` to 90 s, OR fix the cold start by
   [§2.3](#23-pnpm-native-dominates-top-at-60--cpu) so Node starts
   directly.

Source: [`history/2026-09-29--00-30-10-api-healthcheck-fail-plan.md`](history/2026-09-29--00-30-10-api-healthcheck-fail-plan.md).

---

### 2.10 `docker compose up` fails: `couldn't find env file`

**Then do this:**

```bash
# 1. What env file is the script trying to use?
grep -n "env-file\|--env-file" deploy/deploy.sh

# 2. Is infra/.env present locally?
ls -la infra/.env
# If missing: cp infra/.env.example infra/.env and fill in real values.

# 3. Is the env file actually on the droplet after deploy?
ssh root@ssh.aisztens.hu 'ls -la /opt/aisztens/infra/.env'
# If missing on the droplet: it was filtered by the rsync --exclude '.env' rule.
# Fix: deploy.sh explicitly scp-s the .env files AFTER the rsync (already
# in place as of 2026-09-24).  Re-run deploy.sh upload.
```

Source: [`history/2026-09-24--20-06-55-deploy-sh-scp-env-after-upload.md`](history/2026-09-24--20-06-55-deploy-sh-scp-env-after-upload.md).

---

### 2.11 TLS handshake error: `internal error (592)` from Caddy

**Then do this:**

```bash
# 1. Does the rendered Caddyfile contain literal hostnames (no {env.DOMAIN})?
docker compose exec caddy cat /etc/caddy/Caddyfile | grep -E '\.aisztens\.hu'
# Expect: site addresses like "api.aisztens.hu { ... }"

# 2. Does Caddy have a cert for that host?
docker compose exec caddy caddy list-certificates | grep <DOMAIN>
# Expect: a row for each subdomain.

# 3. Re-check the rendered file on disk (NOT the container)
grep -E '\$DOMAIN|\{env\.DOMAIN' /opt/aisztens/infra/caddy/Caddyfile.rendered
# Expect: empty.
```

This error is the **{env.DOMAIN}**-in-site-address Caddy bug — see
[§2.4a](#24a-subject-does-not-qualify-for-certificate-domain).

Source: [`history/2026-09-25--14-10-10-caddyfile-env-substitution-fix.md`](history/2026-09-25--14-10-10-caddyfile-env-substitution-fix.md).

---

### 2.12 `ERR_CONNECTION_TIMED_OUT` from the browser, but `curl` works on the droplet

**Then do this:**

```bash
# 1. Confirm Caddy is bound on 80/443 of the HOST (not just inside the container)
sudo ss -tlnp | grep -E ':(80|443)\b'
# Expect: rows from 'docker-proxy'.

# 2. Are the Cloud Firewall / ufw rules letting 80/443 through?
sudo ufw status        # local iptables view
# And on DigitalOcean: Networking → Firewalls → inbound rules must allow
# TCP 80 / 443 from 0.0.0.0/0 to the droplet's public IP.

# 3. Does the DNS A record point here?
dig +short api.aisztens.hu
# Expect: the droplet's public IPv4.

# 4. From the droplet, hit yourself on the public IP
curl -fsS --resolve api.aisztens.hu:443:$(dig +short api.aisztens.hu | head -1) https://api.aisztens.hu/healthz
```

Source: [`Specs/Production-Runbook.md`](Specs/Production-Runbook.md) §6.

---

### 2.13 ACME logs: `Timeout during connect (likely firewall problem)`

**Then do this:**

```bash
# 1. Confirm port 80 is reachable from the internet
curl -fsS http://api.<DOMAIN>/.well-known/acme-challenge/test
# If timeout: inbound 80 is blocked -> open it in the Cloud Firewall.
#               OR the DNS A record points elsewhere.

# 2. Confirm Let's Encrypt can resolve and connect
docker compose logs --tail=200 caddy | grep -E 'challenge|acme|Timeout'
# 'Timeout during connect' on the challenge callback -> inbound TCP 80.

# 3. As a workaround, switch to DNS-01 challenge if your DNS is on
#    Cloudflare (P2 work; out of scope for this playbook).
```

Source: [`Specs/Production-Runbook.md`](Specs/Production-Runbook.md) §4.3, [`history/2026-09-29--00-18-17-dual-stack-port-collision-fix-impl.md`](history/2026-09-29--00-18-17-dual-stack-port-collision-fix-impl.md).

---

### 2.14 SPA subdomains return 404 / `ERR_FILE_NOT_FOUND`

**Then do this:**

```bash
# 1. Do the dist folders exist on the droplet?
ssh root@ssh.aisztens.hu 'ls -la /opt/aisztens/apps/web/dist /opt/aisztens/apps/admin/dist'
# Expect: index.html + assets/.

# 2. Does the Caddy container see them?
docker compose exec caddy ls -la /srv/web /srv/admin
# Expect: same content.

# 3. If either is empty: the SPA build step was skipped during the
#    GitHub Actions deploy.  Re-run it manually:
cd apps/web && VITE_API_BASE_URL=https://api.aisztens.hu/api pnpm build && cd -
cd apps/admin && VITE_API_BASE_URL=https://api.aisztens.hu/api pnpm build && cd -
scp -r apps/web/dist apps/admin/dist root@ssh.aisztens.hu:/opt/aisztens/apps/

docker compose --env-file infra/.env -f infra/docker-compose.yml restart caddy
```

Source: [`history/2026-09-25--14-56-56-deploy-yml-spa-build-fix.md`](history/2026-09-25--14-56-56-deploy-yml-spa-build-fix.md).

---

### 2.15 `dmesg` shows `Memory cgroup out of memory: Killed process ...`

This is the *symptom* the playbook treats as a category. Match the
**process name** in the `dmesg` line to the playbook entry:

| `dmesg` process name | Most likely cause | Jump to |
|---|---|---|
| `pnpm-native` (inside api) | lockfile-verify OOM | [§2.3](#23-pnpm-native-dominates-top-at-60--cpu) |
| `node` (api) | V8 heap exhausted | [§2.2](#22-api-exits-with-exited-137-oom-killed) |
| `postgres` | `shared_buffers` too high or query spilling to disk | [§2.6](#26-api-container-cannot-reach-postgres) + lower `shared_buffers` |
| `caddy` | TLS handshake spike; raise limit or check for DDoS | bump `mem_limit: 64m` → `128m` |
| `containerd-shim` | A container exceeds its reservation but not its limit | investigate per-container `docker stats` |
| any host process (`kswapd0`, `systemd-journal`) | the host itself is under memory pressure | [§2.17](#217-disk-fills-up-no-space-left-on-device-in-buildpull) + bump droplet tier |

Source: [`history/2026-09-27--01-17-25-container-mem-limits-after-oom-plan.md`](history/2026-09-27--01-17-25-container-mem-limits-after-oom-plan.md).

---

### 2.16 `monitor` container `Restarting (255)` after deploy

**What it means:** `infra/monitor/watch.sh` ran `wget`, the API was not
ready yet (still in `start_period`), `wget` returned non-zero, the shell
exited, container exited 255, Docker restarted it.

**Then do this:**

```bash
# 1. Is the api container healthy yet?
docker inspect aisztens-api-1 --format '{{.State.Health.Status}}'
# If 'starting', give it the full 60 s grace window.

# 2. After api is healthy, restart the monitor
docker compose --env-file infra/.env -f infra/docker-compose.yml restart monitor

# 3. Watch the watchdog loop log
docker compose logs --tail=50 aisztens-monitor-1
# Expect: a row every 30 s saying the API check succeeded.
```

If the monitor keeps dying every 30 s, the watchdog script is exiting
non-zero on a transient curl failure. Long-term fix: wrap `wget` in a
loop with retry — out of scope for this playbook but tracked in
[`history/2026-09-25--14-10-10-caddyfile-env-substitution-fix.md`](history/2026-09-25--14-10-10-caddyfile-env-substitution-fix.md).

---

### 2.17 Disk fills up (`No space left on device` in build/pull)

**Then do this:**

```bash
# 1. Where is the disk being spent?
df -h
sudo du -sh /var/lib/docker/{containers,volumes,overlay2,buildkit} 2>/dev/null

# 2. Which containers have the largest logs?
sudo du -sh /var/lib/docker/containers/*/*-json.log | sort -h | tail

# 3. Reclaim, safely
docker system prune -f                  # stopped containers + dangling images
docker image prune -f                   # dangling layers
docker builder prune -f                 # build cache
# Only as a LAST resort and only after backups:
docker system prune -a -f               # all unused images

# 4. Truncate a runaway container log (safe; the container keeps writing)
sudo truncate -s 0 /var/lib/docker/containers/<id>/<id>-json.log

# 5. Cap future log growth (already done for our services via logging:)
#    Add this to infra/docker-compose.yml if a service is missing it:
#      logging:
#        driver: json-file
#        options: { max-size: "10m", max-file: "3" }
```

---

### 2.18 `deploy.sh` rsync fails with `bash: line 1: <host>: command not found`

**What it means:** the rsync `-e` argument was contaminated with the
`user@host` pair. rsync then appends the destination host again,
producing `ssh <opts> user@host <host> rsync …`, and the remote shell
tries to execute `<host>` as a command.

**Then do this:**

1. The fix is already in [`deploy/deploy.sh`](../deploy/deploy.sh) (one-liner
   was applied 2026-09-24). If you are on an older revision, pull master.
2. Verify locally: `bash -n deploy/deploy.sh` should print `syntax OK`.

Source: [`history/2026-09-24--20-02-39-deploy-sh-rsync-host-bug-fix.md`](history/2026-09-24--20-02-39-deploy-sh-rsync-host-bug-fix.md).

---

### 2.19 Build emits `useradd warning: ... uid is greater than SYS_UID_MAX`

**Then do this:**

- Already fixed by lowering the `nodeapp` uid/gid to 999 in
  [`infra/app/Dockerfile`](../infra/app/Dockerfile).
- The warning is harmless — the user/group are still created — but it
  makes the deploy log noisy. Re-pull to get the fix.

Source: [`history/2026-09-24--20-20-24-api-dockerfile-uid-warning-fix.md`](history/2026-09-24--20-20-24-api-dockerfile-uid-warning-fix.md).

---

## 3. Tool reference (the toolbox behind the playbook)

This is the minimum subset of `docker`, `ss`, `dmesg`, `node`, `psql`,
and `caddy` you need to inspect anything. The scenarios above reference
these by purpose; this section lists them in one place.

### 3.1 Container state

```bash
docker ps -a
docker ps -a --filter 'status=restarting'
docker ps -a --filter 'status=exited'
docker ps -a --filter 'name=aisztens'
docker inspect aisztens-api-1 | jq '.[0].State'
docker inspect aisztens-api-1 | jq '.[0].State.Health'
docker inspect aisztens-api-1 | jq '.[0].HostConfig.Memory'
docker inspect aisztens-api-1 | jq '.[0].RestartCount'
```

### 3.2 Logs

```bash
docker compose -f infra/docker-compose.yml logs --tail=200 -t          # all services
docker compose -f infra/docker-compose.yml logs -f api                # follow api
docker compose -f infra/docker-compose.yml logs --since 30m api       # last 30 min
docker logs --tail=500 aisztens-api-1                                 # raw
docker logs --tail=500 aisztens-api-1 2>&1 | grep -E 'error|warn'     # errors only

# Where is the log file?
sudo ls -l /var/lib/docker/containers/*/*-json.log
sudo truncate -s 0 /var/lib/docker/containers/<id>/<id>-json.log      # safe rotate
```

### 3.3 Resource usage

```bash
docker stats --no-stream                                              # snapshot
docker stats --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'
docker top aisztens-api-1 -o pid,pcpu,pmem,comm                       # inside the container

# Host view
uptime
free -h
vmstat 2 3            # si/so > 0 = swap thrashing
iostat -xz 2 3        # %util ~100% = I/O bound
sudo dmesg --since '-1h' | grep -i 'killed process'
```

### 3.4 Inside a running container

```bash
docker compose -f infra/docker-compose.yml exec api sh          # interactive shell
docker compose -f infra/docker-compose.yml exec api node -e 'console.log(process.memoryUsage())'
docker compose -f infra/docker-compose.yml exec postgres psql -U aisztens -d callback
docker compose -f infra/docker-compose.yml exec caddy caddy validate --config /etc/caddy/Caddyfile
docker compose -f infra/docker-compose.yml exec caddy caddy list-certificates
```

### 3.5 Networking

```bash
docker network ls
docker network inspect aisztens_internal --format '{{range .Containers}}{{.Name}} {{end}}'
docker compose exec api getent hosts postgres                       # alpine
docker compose exec api wget -qO- http://postgres:5432 || echo "tcp ok"
sudo ss -tlnp | grep -E ':(80|443)\b'                               # host -> containers
dig +short api.aisztens.hu                                           # public DNS
```

### 3.6 Filesystem / volumes

```bash
docker volume ls
docker volume inspect aisztens_pgdata | jq '.[0].Mountpoint'
docker compose exec caddy ls -la /srv/web /srv/admin
docker compose exec postgres ls -la /var/lib/postgresql/data
sudo du -sh /var/lib/docker/volumes/* | sort -h | tail
```

### 3.7 Healthcheck specifics

```bash
docker inspect aisztens-api-1 --format '{{json .State.Health}}' | jq .
docker inspect aisztens-api-1 --format '{{json .Config.Healthcheck}}' | jq .
docker compose exec api wget -qO- http://127.0.0.1:3000/healthz
docker compose exec api wget -qO- http://127.0.0.1:3000/api             # smoke
```

### 3.9 Postgres diagnostics

```sql
-- Inside the postgres container
SELECT pid, now()-query_start AS duration, wait_event_type, wait_event,
       state, left(query, 200)
  FROM pg_stat_activity WHERE state IS NOT NULL ORDER BY duration DESC;

SELECT pg_cancel_backend(<pid>);      -- polite kill
SELECT pg_terminate_backend(<pid>);   -- hard kill

-- Locks
SELECT blocked_locks.pid AS blocked_pid,
       blocking_locks.pid AS blocking_pid,
       blocked_activity.query, blocking_activity.query
  FROM pg_stat_activity blocked_activity
  JOIN pg_locks blocked_locks ON blocked_activity.pid = blocked_locks.pid
  JOIN pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
                              AND blocking_locks.pid != blocked_locks.pid
                              AND blocking_locks.granted
  JOIN pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
 WHERE NOT blocked_locks.granted;
```

### 3.10 Node / V8

```bash
docker compose exec api node -e 'console.log(process.memoryUsage())'
docker compose exec api node -e 'console.log(require("v8").getHeapStatistics())'
# Heap snapshot (download and open in chrome://inspect → Memory):
docker compose exec api node -e 'require("v8").writeHeapSnapshot("/tmp/h")'
docker cp aisztens-api-1:/tmp/h ./heap.heapsnapshot
```

---

## 4. Escalation: produce a debug bundle in one command

When you have to ask for help, dump this into `/tmp/aisztens-debug-bundle.txt`
and attach it. The bundle removes ~90 % of the back-and-forth.

```bash
{
    echo '== Environment =='
    date
    pwd
    hostname
    cat /etc/os-release | head -3
    echo
    echo '== Docker version =='
    docker version
    echo
    echo '== docker info (top 30 lines) =='
    docker info | head -30
    echo
    echo '== compose ps -a =='
    docker compose -f infra/docker-compose.yml ps -a
    echo
    echo '== docker stats (no-stream) =='
    docker stats --no-stream --no-trunc
    echo
    echo '== Logs per service (last 200 lines) =='
    for s in api postgres caddy monitor; do
      echo "----- $s -----"
      docker compose -f infra/docker-compose.yml logs --tail=200 -t "$s" 2>&1 || true
    done
    echo
    echo '== docker events (last 1h) =='
    docker events --since 1h --until now
    echo
    echo '== Host load / memory / swap =='
    uptime
    free -h
    vmstat 1 3
    echo
    echo '== OOM killer (last 50) =='
    sudo dmesg | tail -300 | grep -i 'killed process\|out of memory' | tail -50
    echo
    echo '== Host 80/443 listeners =='
    sudo ss -tlnp | grep -E ':(80|443)\b' || echo 'nothing listening on 80/443'
    echo
    echo '== Public DNS =='
    dig +short api.aisztens.hu || true
    dig +short aisztens.hu || true
  } > /tmp/aisztens-debug-bundle.txt 2>&1
  echo "Bundle written: $(wc -l < /tmp/aisztens-debug-bundle.txt) lines"
```

---

## 5. Source-of-truth links

- [`infra/docker-compose.yml`](../infra/docker-compose.yml) — service
  definitions, mem_limits, healthchecks, the `internal` network.
- [`infra/app/Dockerfile`](../infra/app/Dockerfile) — runtime image; the
  `node apps/api/dist/main.js` CMD that bypasses `pnpm-native`.
- [`infra/caddy/Caddyfile`](../infra/caddy/Caddyfile) and
  [`infra/caddy/Caddyfile.rendered`](../infra/caddy/Caddyfile.rendered) —
  template vs rendered.
- [`deploy/deploy.sh`](../deploy/deploy.sh) — `prune_legacy_stack()`,
  `render_caddyfile()`, `upload()` flow.
- [`deploy/bootstrap.sh`](../deploy/bootstrap.sh) — `configure_swap()`.
- [`apps/api/src/health/health.controller.ts`](../apps/api/src/health/health.controller.ts)
  — the `/healthz` endpoint the Docker healthcheck and the monitor
  watchdog both call.
- [`Specs/Production-Runbook.md`](Specs/Production-Runbook.md) — the
  deploy-time verification checklist (runbook §4.1 has the
  `ps -a` discipline; §6 has the failure matrix).
- [`Specs/Caddy-Reverse-Proxy.md`](Specs/Caddy-Reverse-Proxy.md) — the
  Caddy contract.
- History files (deep dives on every bug the playbook resolves):
  - [`2026-09-23-…-github-action-deploy-with-smoke-tests-impl.md`](history/2026-09-23--16-45-06-github-action-deploy-with-smoke-tests-impl.md)
  - [`2026-09-24-…-deploy-sh-rsync-host-bug-fix.md`](history/2026-09-24--20-02-39-deploy-sh-rsync-host-bug-fix.md)
  - [`2026-09-24-…-deploy-sh-scp-env-after-upload.md`](history/2026-09-24--20-06-55-deploy-sh-scp-env-after-upload.md)
  - [`2026-09-24-…-api-dockerfile-uid-warning-fix.md`](history/2026-09-24--20-20-24-api-dockerfile-uid-warning-fix.md)
  - [`2026-09-25-…-caddyfile-env-substitution-fix.md`](history/2026-09-25--14-10-10-caddyfile-env-substitution-fix.md) *(SUPERSEDED — see header)*
  - [`2026-09-25-…-three-subdomain-routing-impl.md`](history/2026-09-25--14-43-32-three-subdomain-routing-impl.md)
  - [`2026-09-25-…-deploy-yml-spa-build-fix.md`](history/2026-09-25--14-56-56-deploy-yml-spa-build-fix.md)
  - [`2026-09-27-…-container-mem-limits-after-oom-plan.md`](history/2026-09-27--01-17-25-container-mem-limits-after-oom-plan.md)
  - [`2026-09-27-…-container-mem-limits-impl.md`](history/2026-09-27--01-19-19-container-mem-limits-impl.md)
  - [`2026-09-28-…-production-runbook-and-docker-compose-ps-gotcha.md`](history/2026-09-28--19-22-51-production-runbook-and-docker-compose-ps-gotcha.md)
  - [`2026-09-29-…-dual-stack-port-collision-fix-plan.md`](history/2026-09-29--00-06-14-dual-stack-port-collision-fix-plan.md)
  - [`2026-09-29-…-dual-stack-port-collision-fix-impl.md`](history/2026-09-29--00-18-17-dual-stack-port-collision-fix-impl.md)
  - [`2026-09-29-…-api-healthcheck-fail-plan.md`](history/2026-09-29--00-30-10-api-healthcheck-fail-plan.md)
  - [`2026-09-29-…-api-healthcheck-fail-impl.md`](history/2026-09-29--00-34-28-api-healthcheck-fail-impl.md)
  - [`2026-09-29-…-pnpm-native-oom-restart-loop-plan.md`](history/2026-09-29--00-50-12-pnpm-native-oom-restart-loop-plan.md)

### Milestones

- [`2026-09-28-caddy-restart-loop-and-mem-limits`](milestones/2026-09-28--13-35-06-caddy-restart-loop-and-mem-limits.milestone.md)
- [`2026-09-28-production-runbook-and-compose-ps-gotcha`](milestones/2026-09-28--19-23-20-production-runbook-and-compose-ps-gotcha.milestone.md)
- [`2026-09-29-dual-stack-port-collision-fix`](milestones/2026-09-29--00-18-00-dual-stack-port-collision-fix.milestone.md)
- [`2026-09-29-api-healthcheck-fail`](milestones/2026-09-29--00-34-49-api-healthcheck-fail.milestone.md)