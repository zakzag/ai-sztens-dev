# Docker Debugging Cheatsheet

A swiss-army-knife reference for debugging Docker containers, with a focus on the
**AIsztens** stack ([`infra/docker-compose.yml`](../infra/docker-compose.yml)):
`api` (NestJS + Fastify), `postgres` (16-alpine), `caddy` (2-alpine reverse proxy),
and `monitor` (curl-based watchdog).

Use it when:

- a container is slow, restarting, or "slowing down the whole PC",
- you need to inspect logs but don't know which flag to use,
- a service is "Up" but the app is dead,
- you want to find out which process inside a container eats the CPU/RAM,
- you need to poke inside a running container without restarting it.

> **Tip:** everything below assumes you are either on the droplet via SSH or in
> the project root on your dev machine. On the droplet, `cd` into
> `~/aisztens/infra` (or wherever you cloned the repo) before running
> `docker compose` commands.

---

## Table of contents

1. [Quick triage flow](#1-quick-triage-flow)
2. [Container state — what's up, what's not](#2-container-state--whats-up-whats-not)
3. [Logs — the single most useful skill](#3-logs--the-single-most-useful-skill)
4. [Resource usage — finding the hog](#4-resource-husage--finding-the-hog)
5. [Why is my PC slow? Host↔container investigation)
6. [Inside a running container (no restart)](#6-inside-a-running-container-no-restart)
7. [Caddy-specific debugging](#7-caddy-specific-debugging)
8. [Node / API-specific debugging](#8-node--api-specific-debugging)
9. [Postgres-specific debugging](#9-postgres-specific-debugging)
10. [Networking — services can't reach each other](#10-networking--services-cant-reach-each-other)
11. [Filesystem — mounts, volumes, logs on disk](#11-filesystem--mounts-volumes-logs-on-disk)
12. [Healthchecks — "unhealthy" vs "Restarting"](#12-healthchecks--unhealthy-vs-restarting)
13. [Build / image debugging](#13-build--image-debugging)
14. [One-liner recipes for this repo](#14-one-liner-recipes-for-this-repo)
15. [Cleanup — reclaiming disk and memory](#15-cleanup--reclaiming-disk-and-memory)
16. [When to escalate](#16-when-to-escalate)

---

## 1. Quick triage flow

When something is broken, run these in order — they get you 80% of the answer
in under a minute:

```bash
# 1. Are all containers running?
docker compose -f infra/docker-compose.yml ps

# 2. Anything restarting?
docker compose -f infra/docker-compose.yml ps | grep -E 'Restarting|Exited|unhealthy'

# 3. Last 100 lines of every service
docker compose -f infra/docker-compose.yml logs --tail=100

# 4. Follow one specific service live
docker compose -f infra/docker-compose.yml logs -f api

# 5. Live resource snapshot
docker stats

# 6. Top processes inside the suspect container
docker compose -f infra/docker-compose.yml top api
```

If that doesn't tell you anything, jump to the matching section below.

---

## 2. Container state — what's up, what's not

### Show all containers (including exited)

```bash
docker ps -a                  # default wide output
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker ps -a --filter 'status=exited'      # only crashed
docker ps -a --filter 'status=restarting'  # in a restart loop
docker ps -a --filter 'name=aisztens'      # just our stack
```

Key status strings to recognise:

| Status | Meaning | Likely cause |
|---|---|---|
| `Up X minutes (healthy)` | Running and healthcheck passes | — |
| `Up X minutes` | Running, no healthcheck defined | — |
| `Up X minutes (health: starting)` | Still inside `start_period` | normal on cold start (api has 60s grace) |
| `Restarting (X) Y seconds ago` | Crashed and is being restarted | check `docker logs`, almost always app crash or OOM |
| `Exited (code) Y seconds ago` | Stopped, will not auto-restart | crash or `docker stop` |
| `Exited (137)` | SIGKILL — **kernel OOM-killer** | host or cgroup out of memory |
| `Exited (139)` | SIGSEGV | native crash in the binary |
| `Exited (143)` | SIGTERM | `docker stop`, `docker compose down` |

### Inspect a single container

```bash
docker inspect aisztens-api-1          # everything (huge JSON)
docker inspect aisztens-api-1 | jq '.[0].State'
docker inspect aisztens-api-1 | jq '.[0].HostConfig.Memory'
docker inspect aisztens-api-1 | jq '.[0].RestartCount'
docker inspect aisztens-api-1 | jq '.[0].State.Health'
```

### Restart / stop / start

```bash
docker compose -f infra/docker-compose.yml restart api
docker compose -f infra/docker-compose.yml up -d --no-deps api   # recreate only api
docker compose -f infra/docker-compose.yml stop postgres
docker compose -f infra/docker-compose.yml kill api              # SIGKILL
```

---

## 3. Logs — the single most useful skill

### The four log commands you actually use

```bash
# Last 200 lines, all services, with timestamps
docker compose -f infra/docker-compose.yml logs --tail=200 -t

# Follow one service live (Ctrl-C to exit)
docker compose -f infra/docker-compose.yml logs -f api

# Logs since a point in time
docker compose -f infra/docker-compose.yml logs --since 30m api
docker compose -f infra/docker-compose.yml logs --since 2026-09-29T08:00:00Z api

# Logs between two timestamps
docker compose -f infra/docker-compose.yml logs --since 30m --until 10m api

# Just stderr (most crashes print there)
docker compose -f infra/docker-compose.yml logs -f api 2>&1 | grep -v INFO
```

### Log flags cheat-sheet

| Flag | What it does |
|---|---|
| `-f`, `--follow` | Stream new lines (like `tail -f`) |
| `--tail N` | Only show the last N lines |
| `-t`, `--timestamps` | Prefix each line with an ISO timestamp |
| `--since 30m` | Lines from the last 30 minutes |
| `--until 10m` | Lines older than 10 minutes |
| `--no-log-prefix` | Strip the `service-name-1 \|` prefix |

### Filtering tricks

```bash
# All "error" / "warn" / "fail" lines across the stack
docker compose -f infra/docker-compose.yml logs --no-color \
  | grep -iE 'error|warn|fail|throw|unhandled|exception'

# Count occurrences (great for "is this happening once or a thousand times?")
docker compose -f infra/docker-compose.yml logs --no-color api \
  | grep -c 'ECONNREFUSED'
```

### Per-container logs without compose

```bash
docker logs aisztens-api-1
docker logs --tail=500 --since=1h aisztens-api-1
```

### Where does Docker keep the logs on disk?

By default: `/var/lib/docker/containers/<id>/<id>-json.log`. They grow until
Docker rotates them (`log-driver` json-file default: 10 MB × 3 files).

```bash
# See how big each container's log is
sudo du -sh /var/lib/docker/containers/*/*-json.log | sort -h | tail

# Force-rotate by truncating (safe; the container keeps writing)
sudo truncate -s 0 /var/lib/docker/containers/<id>/<id>-json.log
```

Tame runaway logs in [`infra/docker-compose.yml`](../infra/docker-compose.yml)
under each service:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

---

## 4. Resource usage — finding the hog

### `docker stats` — live, per-container

```bash
docker stats                                 # all running
docker stats --no-stream                     # one snapshot, exit
docker stats --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}'
docker stats aisztens-api-1 aisztens-postgres-1   # specific containers
```

Columns:

- `CPU %` — share of *one* host core. `400%` on a 4-core box means saturated.
- `MEM USAGE / LIMIT` — current RSS, then the `mem_limit` from compose.
- `MEM %` — `usage / limit`. If it pins near `LIMIT`, the cgroup will OOM.
- `NET I/O` / `BLOCK I/O` — bytes in/out.

### Why is my PC slow? Host↔container investigation

A container that "slows down the host" is usually one of three things:

1. **CPU-bound** (e.g. a runaway Node loop, runaway Postgres query). Symptom:
   host load average jumps, `docker stats` shows `CPU%` >> 100% for one box.
2. **Memory pressure / swap thrashing**. Symptom: everything on the host
   becomes laggy, the suspect container's `MEM%` stays near 100% and Linux
   starts swapping.
3. **Disk I/O saturation** (write-ahead log storm, log spam to bind mount).
   Symptom: every process on the host waits on I/O.

Run these on the **host** (or inside WSL):

```bash
# 1. Overall load
uptime
top -bn1 | head -20

# 2. Memory + swap
free -h
vmstat 2 5        # si/so > 0 = swap thrashing

# 3. Disk I/O
iostat -xz 2 5    # await > ~5 ms or %util ~100% = saturated

# 4. Who is using CPU right now?
ps -eo pid,pcpu,pmem,rss,comm --sort=-pcpu | head

# 5. Map a PID back to a container
#    (requires you to know the host PID — get it from docker top)
docker top aisztens-api-1 axo pid,pcpu,pmem,comm

# 6. Is the kernel OOM-killer firing?
dmesg | grep -i 'killed process' | tail
sudo journalctl -k | grep -i 'out of memory' | tail
```

If `dmesg` shows your `node` process being killed: the container hit
`mem_limit` (in our compose: 400m for the api, 400m for postgres, 64m for
caddy, 32m for monitor). Either raise the limit or shrink the heap.

### Process tree inside a container

```bash
docker compose -f infra/docker-compose.yml top api
docker top aisztens-api-1 -o pid,pcpu,pmem,etime,comm
```

### `docker events` — what just happened?

```bash
docker events --since 30m --until now
docker events --filter 'container=aisztens-api-1'
```

Watch for `oom`, `kill`, `restart`, `die`, `health_status: unhealthy`.

---

## 6. Inside a running container (no restart)

### Run a one-off command

```bash
docker compose -f infra/docker-compose.yml exec api sh
docker compose -f infra/docker-compose.yml exec api ps -U ildom
docker compose -f infra/docker-compose.yml exec api node -v
docker compose -f infra/docker-compose.yml exec postgres psql -U postgres -d callback
```

The first form opens a shell. Common shells in our images:

| Service | Default shell | Fallback |
|---|---|---|
| `api` (Node 20 alpine) | `sh` (alpine ships busybox) | `ash` |
| `postgres` (alpine) | `sh` | — |
| `caddy` (alpine) | `sh` | — |
| `monitor` (alpine) | `sh` | — |

### Run a command without entering

```bash
docker compose -f infra/docker-compose.yml exec api node -e 'console.log(process.memoryUsage())'
docker compose -f infra/docker-compose.yml exec api ls -la /app
docker compose -f infra/docker-compose.yml exec api env | sort
```

### Inspect the process tree inside

```bash
docker compose -f infra/docker-compose.yml exec api ps -ef
docker compose -f infra/docker-compose.yml exec api ps -eo pid,pcpu,pmem,rss,vsz,comm --sort=-pcpu
```

### Inspect Node's own state

```bash
# Inside the api container
node -e 'console.log(process.memoryUsage())'                 # heap + RSS
node -e 'console.log(process.report.getReport().header)'    # V8 build info
node -e 'console.log(require("v8").getHeapStatistics())'    # heap layout
node --inspect=0.0.0.0:9229 main.js                          # enable inspector
```

### One-shot sidecar for debugging (does NOT modify the running container)

```bash
docker run --rm -it --network aisztens_internal alpine sh
docker run --rm -it --network aisztens_internal nicolaka/netshoot
```

The container name for the stack's user-defined network is
`aisztens_internal` (because `name: aisztens` in [`infra/docker-compose.yml`](../infra/docker-compose.yml)
prefixes networks). Replace `_` with `-` when Docker complains.

---

## 7. Caddy-specific debugging

Caddy is small but it owns port 80/443 and is the most common source of
"everything is broken at the edge".

### Logs

```bash
docker compose -f infra/docker-compose.yml logs -f caddy
```

Look for:

- `tls: error ...` → ACME / cert issues
- `http: TLS handshake error` → client side
- `dial tcp <ip>:3000: connect: connection refused` → upstream (api) is dead
- `lookup ... 127.0.0.53:53: read: connection refused` → DNS broken inside
  container (Ubuntu droplets default to systemd-resolved on 127.0.0.53).
  Already mitigated in compose via `dns: 1.1.1.1, 8.8.8.8`.
- `serving HTTPS on :443` → Caddy is healthy

### Validate config without restarting

```bash
docker compose -f infra/docker-compose.yml exec caddy caddy validate --config /etc/caddy/Caddyfile
docker compose -f infra/docker-compose.yml exec caddy caddy fmt -- /etc/caddy/Caddyfile    # pretty-print
```

### Adapt config live (Caddy's admin API is at :2019 by default)

```bash
# Open admin endpoint from your host (one-shot)
docker run --rm --network aisztens_internal caddy:2 caddy reverse-proxy --from example.com --to http://api:3000

# Or POST a new config to the admin API (the file mounted is the source of truth,
# so this only sticks until Caddy reloads)
curl -X POST http://127.0.0.1:2019/load \
  -H 'Content-Type: application/json' \
  --data-binary @Caddyfile.json
```

### Inspect the active config

```bash
docker compose -f infra/docker-compose.yml exec caddy caddy adapt --config /etc/caddy/Caddyfile --pretty
```

### Test from inside the network

```bash
docker compose -f infra/docker-compose.yml exec caddy wget -qO- http://api:3000/healthz
docker compose -f infra/docker-compose.yml exec caddy curl -vI https://example.com/        # if curl is installed
```

If `curl` is not in the caddy image (it isn't by default), use `wget` or run a
one-shot `curlimages/curl` sidecar (see section 6).

### Where Caddy keeps certs

```bash
docker compose -f infra/docker-compose.yml exec caddy ls -la /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/
docker compose -f infra/docker-compose.yml exec caddy cat /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/<domain>/<domain>.crt | openssl x509 -noout -dates -subject
```

### Force a cert renewal

```bash
docker compose -f infra/docker-compose.yml exec caddy caddy certs --renew
```

---

## 8. Node / API-specific debugging

The api is built from [`infra/app/Dockerfile`](../infra/app/Dockerfile) and runs
NestJS + Fastify on port 3000.

### Inspect the running process

```bash
docker compose -f infra/docker-compose.yml exec api ps -ef
docker compose -f infra/docker-compose.yml exec api ls -la /app
docker compose -f infra/docker-compose.yml exec api env | sort
docker compose -f infra/docker-compose.yml exec api cat /app/package.json
```

### V8 memory & GC

```bash
# Quick snapshot
docker compose -f infra/docker-compose.yml exec api node -e '
  const m = process.memoryUsage();
  console.log(JSON.stringify(m, null, 2));
'

# Heap statistics (heap sizes, used vs total)
docker compose -f infra/docker-compose.yml exec api node -e '
  const v8 = require("v8");
  console.log(JSON.stringify(v8.getHeapStatistics(), null, 2));
'

# Trigger a GC and re-measure (only works if --expose-gc was passed)
docker compose -f infra/docker-compose.yml exec api node --expose-gc -e '
  global.gc(); console.log(process.memoryUsage());
'
```

### Process-wide heap snapshot (find a leak)

```bash
docker compose -f infra/docker-compose.yml exec api node -e '
  const v8 = require("v8"); const fs = require("fs");
  const snap = v8.writeHeapSnapshot("/tmp/heap.heapsnapshot");
  console.log("wrote", snap);
'
docker cp aisztens-api-1:/tmp/heap.heapsnapshot ./heap.heapsnapshot
# Open in Chrome: chrome://inspect → Memory tab → Load snapshot
```

### CPU profile

```bash
docker compose -f infra/docker-compose.yml exec api node --prof main.js
# Run for a while, then SIGINT (Ctrl-C) and:
docker compose -f infra/docker-compose.yml exec api node --prof-process isolate-*.log > processed.txt
```

### Inspector (live debugger / breakpoints)

In [`infra/docker-compose.yml`](../infra/docker-compose.yml) for the `api`
service, **temporarily** add:

```yaml
    ports:
      - "9229:9229"
    command: ["node", "--inspect=0.0.0.0:9229", "dist/main.js"]
```

Then on your dev machine:

```
chrome://inspect → "Configure" → add `host:9229`
```

### Common Node errors and fixes

| Symptom in logs | Cause | Fix |
|---|---|---|
| `JavaScript heap out of memory` | RSS grows until V8 throws | raise `--max-old-space-size` in Dockerfile (we use 384 MB) or find the leak with a heap snapshot |
| `EADDRINUSE :::3000` | Port 3000 is already bound inside the container | another process (an orphaned `node`) is alive; `ps -ef` and `kill` |
| `ECONNREFUSED 127.0.0.1:5432` from api to postgres | api is reaching `localhost` instead of `postgres` | the `DATABASE_URL` must use `postgres:5432`, not `127.0.0.1:5432` (compose's service name resolves on the `internal` network) |
| `MODULE_NOT_FOUND` | pnpm workspace symlinks not built | rebuild the image with `docker compose build api` |
| `FATAL ERROR: Reached heap limit` | Same as OOM, but explicit | increase heap or fix the leak |

---

## 9. Postgres-specific debugging

Postgres is `postgres:16-alpine` with a 400 MB cap. Slow queries or
checkpoint storms are the most common cause of "the database slows down
the API".

### Connect from inside the container

```bash
docker compose -f infra/docker-compose.yml exec postgres psql -U postgres -d callback
docker compose -f infra/docker-compose.yml exec postgres psql -U aisztens -d callback
```

### What is running right now?

```sql
SELECT pid, now() - pg_stat_activity.query_start AS duration, wait_event_type, wait_event,
       state, left(query, 200)
  FROM pg_stat_activity
 WHERE state IS NOT NULL
 ORDER BY duration DESC;
```

`wait_event_type = Lock` → row lock contention.
`wait_event_type = IO` / `DataFileRead` → disk-bound (slow disk).
`wait_event = WALWrite` → checkpoint storm.

### Kill a runaway query

```sql
SELECT pg_cancel_backend(<pid>);     -- polite
SELECT pg_terminate_backend(<pid>);  -- hard
```

### Locks

```sql
SELECT blocked_locks.pid AS blocked_pid,
       blocking_locks.pid AS blocking_pid,
       blocked_activity.query AS blocked_query,
       blocking_activity.query AS blocking_query
  FROM pg_stat_activity blocked_activity
  JOIN pg_locks blocked_locks     ON blocked_activity.pid = blocked_locks.pid
  JOIN pg_locks blocking_locks     ON blocking_locks.locktype = blocked_locks.locktype
                                  AND blocking_locks.pid != blocked_locks.pid
                                  AND blocking_locks.granted
  JOIN pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
 WHERE NOT blocked_locks.granted;
```

### Slow query log

Enable per-session without restart:

```sql
ALTER SYSTEM SET log_min_duration_statement = '500ms';
SELECT pg_reload_conf();
```

### Disk usage

```sql
SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database;
SELECT relname, pg_size_pretty(pg_relation_size(relid))
  FROM pg_stat_user_tables ORDER BY pg_relation_size(relid) DESC LIMIT 20;
```

### Connection counts

```sql
SELECT count(*), state, application_name FROM pg_stat_activity GROUP BY 2, 3;
SHOW max_connections;
```

### Healthcheck on Postgres

```bash
docker compose -f infra/docker-compose.yml exec postgres pg_isready -U postgres -d callback
docker compose -f infra/docker-compose.yml exec postgres psql -U postgres -d callback -c 'select 1'
```

### Memory tuning knobs already in compose

```
POSTGRES_SHARED_BUFFERS: 128MB
POSTGRES_EFFECTIVE_CACHE_SIZE: 512MB
POSTGRES_WORK_MEM: 4MB
```

If Postgres is constantly at the 400 MB cap, either queries are spilling to
disk (`work_mem` too low for a hash join) or it is checkpointing too often.

---

## 10. Networking — services can't reach each other

The stack has a single user-defined bridge network called `internal`. On the
compose-level CLI the DNS name is the **service name** (`api`, `postgres`,
`caddy`, `monitor`), not the container name.

```bash
# Inspect the network
docker network inspect aisztens_internal

# Which containers are attached
docker network inspect aisztens_internal --format '{{range .Containers}}{{.Name}} {{end}}'

# Resolve a service name from inside the network
docker compose -f infra/docker-compose.yml exec api nslookup postgres
docker compose -f infra/docker-compose.yml exec api getent hosts postgres   # alpine

# Are two services actually reachable?
docker compose -f infra/docker-compose.yml exec api wget -qO- http://api:3000/healthz
docker compose -f infra/docker-compose.yml exec api wget -qO- http://postgres:5432   # will fail on protocol, but TCP connects
```

If a service cannot reach another:

1. Are they on the same network? `docker network inspect aisztens_internal`.
2. Is the target port **exposed**? In compose, `expose:` only allows
   intra-network access; `ports:` is needed for host access.
3. Is the target healthy? `depends_on: condition: service_healthy` makes
   dependents wait. A service that is still in `health: starting` will not
   be reachable for its dependents in some cases.

### Host → container (or container → host)

```bash
# From the host, hit Postgres in the published port (if you have one)
psql -h 127.0.0.1 -p 5432 -U postgres

# From the host, hit Caddy
curl -vI https://example.com/
curl -vI http://127.0.0.1/         # Caddy listens on 80 inside the container
```

---

## 11. Filesystem — mounts, volumes, logs on disk

### Where are the volumes?

```bash
docker volume ls
docker volume inspect aisztens_pgdata
docker volume inspect aisztens_caddy_data
```

### Where do the bind mounts point inside the container?

```bash
docker inspect aisztens-api-1 \
  | jq '.[0].Mounts[] | {Type, Source, Destination, Mode}'
```

For our stack:

| Source on host | Destination in container | Purpose |
|---|---|---|
| `./caddy/Caddyfile.rendered` | `/etc/caddy/Caddyfile` | rendered reverse-proxy config |
| `caddy_data` volume | `/data` | TLS certs |
| `caddy_config` volume | `/config` | Caddy's runtime config |
| `${WEB_DIST_PATH:-../apps/web/dist}` | `/srv/web` | web SPA bundle |
| `${ADMIN_DIST_PATH:-../apps/admin/dist}` | `/srv/admin` | admin SPA bundle |
| `pgdata` volume | `/var/lib/postgresql/data` | DB files |

### Tail a mounted log file (when `docker logs` is not enough)

```bash
# Caddy access log style
sudo tail -f /var/lib/docker/volumes/aisztens_caddy_data/_data/caddy/access.log
```

### Disk space

```bash
docker system df
docker system df -v

# What's filling the docker data root?
sudo du -sh /var/lib/docker/* | sort -h
```

---

## 12. Healthchecks — "unhealthy" vs "Restarting"

Every service in our compose has either an explicit or implicit healthcheck.

### Inspect a healthcheck

```bash
docker inspect aisztens-api-1 | jq '.[0].State.Health'
docker inspect aisztens-api-1 | jq '.[0].Config.Healthcheck'
```

The `Health` object shows the last N probe results:

```json
{
  "Status": "healthy",
  "FailingStreak": 0,
  "Log": [
    {"Start": "...", "End": "...", "ExitCode": 0, "Output": ""},
    ...
  ]
}
```

A non-zero `ExitCode` in the last entry + `FailingStreak` ≥ retries
(`api` has `retries: 10` → unhealthy).

### Why "unhealthy"?

Look at the last log entry:

```bash
docker inspect aisztens-api-1 \
  | jq '.[0].State.Health.Log[-1]'
```

Common causes for the api healthcheck (`/healthz`):

- process not listening yet → inside `start_period` (60 s grace).
- DB unreachable → `http://api:3000/healthz` returns 503 if the controller
  checks the DB. Confirm by hitting it manually:
  `docker compose exec api wget -qO- http://127.0.0.1:3000/healthz`.
- the process is alive but the shell snippet failed (rare; the controller
  explicit `process.exit` covers most cases).

### Why "Restarting"?

`Restarting` means the **main container process** exited. The healthcheck
isn't even running anymore. Look at `docker logs aisztens-api-1 | tail` —
the *last* lines are the actual reason.

For Node specifically, search for:

```bash
docker logs aisztens-api-1 2>&1 | tail -200 \
  | grep -iE 'error|exception|killed|signal|out of memory'
```

---

## 13. Build / image debugging

### Build with progress and verbose output

```bash
docker compose -f infra/docker-compose.yml build --progress=plain api
docker build --progress=plain -f infra/app/Dockerfile .
```

### Build a single stage and poke at it

```bash
docker build --target <stage> -t debug-stage -f infra/app/Dockerfile .
docker run --rm -it debug-stage sh
```

### Inspect image layers

```bash
docker history aisztens/api:latest
docker history --no-trunc aisztens/api:latest | less
```

### Image vs running config

```bash
# What's in the image's CMD/ENV
docker inspect aisztens/api:latest | jq '.[0].Config.Cmd, .[0].Config.Env'
```

### Why is my build so slow?

- `--no-cache` → forces every layer to rebuild.
- `package.json` / lockfile changed → reinstall.
- BuildKit cache not persisted → `BUILDKIT_PROGRESS=plain` shows it.
- Bind-mounted `node_modules` or `.git` → check `.dockerignore`.

---

## 14. One-liner recipes for this repo

All examples assume the repo root as cwd, and use the user-defined project
name `aisztens` (from `name: aisztens` in compose).

```bash
# Top 20 lines of every log, labelled by service, with timestamps
docker compose -f infra/docker-compose.yml logs --tail=20 -t

# Only errors across the whole stack
docker compose -f infra/docker-compose.yml logs --no-color \
  | grep -iE 'error|exception|fatal|panic|unhandled' \
  | grep -v 'healthcheck' \
  | tail -50

# Resource snapshot, sortable
docker stats --no-stream --format \
  'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}'

# Memory snapshot inside the api (heap + RSS)
docker compose -f infra/docker-compose.yml exec api \
  node -e 'const m=process.memoryUsage(),v=require("v8").getHeapStatistics(); console.log({m,v})'

# Is the api responding from inside the network?
docker compose -f infra/docker-compose.yml exec api \
  wget -qO- http://127.0.0.1:3000/healthz

# Postgres currently-running queries
docker compose -f infra/docker-compose.yml exec postgres \
  psql -U postgres -d callback -c \
    "SELECT pid, now()-query_start AS age, state, left(query,80) FROM pg_stat_activity WHERE state IS NOT NULL ORDER BY age DESC;"

# Caddy config — is it valid?
docker compose -f infra/docker-compose.yml exec caddy \
  caddy validate --config /etc/caddy/Caddyfile

# Caddy: render the live config from the template (for inspection)
docker compose -f infra/docker-compose.yml exec caddy \
  caddy adapt --config /etc/caddy/Caddyfile --pretty

# Tail the api log specifically and follow new lines
docker compose -f infra/docker-compose.yml logs -f api

# Tail all logs to a file for sharing
docker compose -f infra/docker-compose.yml logs --no-color --since 1h > /tmp/aisztens.log
```

---

## 15. Cleanup — reclaiming disk and memory

```bash
# Show disk usage
docker system df

# Remove stopped containers, dangling images, unused networks, build cache
docker system prune
docker system prune -a         # also remove unused images (CAREFUL)

# Remove everything for *this* stack only
docker compose -f infra/docker-compose.yml down --volumes --remove-orphans

# Just prune the build cache (safe)
docker builder prune

# Stop *all* Docker activity on the host (last resort)
docker stop $(docker ps -q)
```

> **Note:** `docker compose down -v` will delete the named volumes
> `pgdata`, `caddy_data`, `caddy_config`. That means **DB data loss** and
> **forced ACME re-registration**. Use only on dev.

---

## 16. When to escalate

If after all of the above you still don't know why a container slows the
host, gather this and ask for help:

```bash
# Minimal triage bundle
{
  echo '== docker version =='
  docker version
  echo
  echo '== docker info =='
  docker info
  echo
  echo '== docker stats (no-stream) =='
  docker stats --no-stream --no-trunc
  echo
  echo '== compose ps =='
  docker compose -f infra/docker-compose.yml ps
  echo
  echo '== last 200 lines per service =='
  docker compose -f infra/docker-compose.yml logs --tail=200 -t
  echo
  echo '== recent events =='
  docker events --since 1h --until now
  echo
  echo '== host load / memory =='
  uptime; free -h; vmstat 2 3
  echo
  echo '== oom-killer (last 50) =='
  dmesg | tail -200 | grep -i 'killed process' | tail -50
} > /tmp/aisztens-debug-bundle.txt
```

Hand the bundle (`/tmp/aisztens-debug-bundle.txt`) over; it removes 90%
of the back-and-forth.

---

## See also

- [Production Runbook](Specs/Production-Runbook.md)
- [Caddy Reverse Proxy spec](Specs/Caddy-Reverse-Proxy.md)
- [`infra/docker-compose.yml`](../infra/docker-compose.yml) — the source of
  truth for memory limits, healthchecks and the user-defined `internal` network
- [`infra/app/Dockerfile`](../infra/app/Dockerfile) — Node heap limits
- [`apps/api/src/health/health.controller.ts`](../apps/api/src/health/health.controller.ts) —
  what `/healthz` actually checks