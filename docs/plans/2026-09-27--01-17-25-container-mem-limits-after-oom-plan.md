# Plan: Container memory limits after deploy OOM

- Date: 2026-09-26
- Status: Planned
- Scope: Add `mem_limit` to every service in [`infra/docker-compose.yml`](../../infra/docker-compose.yml),
  tune Node + Postgres heap parameters so the limits are honoured, and provision a 2 GB swap file in
  [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh) as a safety net.

## 1. Problem

After deploy the droplet (1 GB Basic) became slow. `top` showed:

- `kswapd0` at ~50% CPU for 24+ minutes — kernel swap-thrashing.
- `pnpm-native` (DigitalOcean `do-agent`) using 615 MB RES / 62.5% MEM — known memory leak
  on long-uptime droplets.
- `systemd-journal`, `postgres`, `curl`, `containerd-shim` all in `D` state — everyone blocked
  on disk I/O because of the swap-thrash.

The four services in [`infra/docker-compose.yml`](../../infra/docker-compose.yml:17) (`api`,
`postgres`, `caddy`, `monitor`) had **no memory limits**, so any one of them could push the
1 GB host over the edge. Combined with the DO agent leak and the absence of swap, the kernel
started evicting pages to disk and the whole box stalled.

The application itself (`api` container) is not visible in the `top` snapshot as a culprit —
the slow-down is purely host-side resource pressure.

## 2. Decision

Two-layer mitigation:

1. **Resize droplet from 1 GB Basic to 2 GB Basic** ($6 → $12/month).
   2 GB is the smallest tier that comfortably runs the stack + the leaking `do-agent`
   without re-entering swap-thrash within days of uptime.
2. **Cap each container with `mem_limit`** so the host can no longer be starved by one
   runaway process. Tune the corresponding runtime parameters (`--max-old-space-size` for
   Node, Postgres `shared_buffers`/`effective_cache_size`/`work_mem` envs) so the limits
   are honoured at the application level, not just by the kernel OOM-killer.

A 2 GB swap file is also added to `bootstrap.sh` as a safety net for the `do-agent` leak
spikes.

## 3. Memory budget on the 2 GB droplet

| Component | Current | After | Notes |
|---|---|---|---|
| Host OS + systemd-journal + sshd | ~150 MB | ~150 MB | not a container, fixed |
| `dockerd` + `containerd` | ~190 MB | ~190 MB | not a container, fixed |
| `do-agent` (pnpm-native) | 615 MB+ | ~600 MB | not configurable, we just live with it |
| `api` (Node + NestJS + Fastify) | uncapped | **400 MB** | `--max-old-space-size=384` |
| `postgres` (16-alpine) | uncapped | **400 MB** | `shared_buffers=128`, `effective_cache_size=512`, `work_mem=4` |
| `caddy` | ~30 MB | **64 MB** | safety headroom for slow TLS / big uploads |
| `monitor` | ~10 MB | **32 MB** | curl + bash sleep only |
| **Sum** | unbounded | **~1.84 GB** | fits inside 2 GB, ~160 MB headroom + swap |

## 4. Files to change

### 4.1 [`infra/docker-compose.yml`](../../infra/docker-compose.yml)

Add `mem_limit` (and where useful `mem_reservation`) to each service:

- `api` → `mem_limit: 400m`
- `postgres` → `mem_limit: 400m` + new envs
  `POSTGRES_SHARED_BUFFERS=128MB`,
  `POSTGRES_EFFECTIVE_CACHE_SIZE=512MB`,
  `POSTGRES_WORK_MEM=4MB`
- `caddy` → `mem_limit: 64m`
- `monitor` → `mem_limit: 32m`

`mem_reservation` is intentionally **not** set on the host-level services because on a
2 GB droplet the kernel scheduler reservation fights with the DO agent's RSS and produces
unnecessary OOMs. The hard limit is enough.

### 4.2 [`infra/app/Dockerfile`](../../infra/app/Dockerfile)

Add `ENV NODE_OPTIONS=--max-old-space-size=384` to the runtime stage so the V8 heap
gives up *before* the container limit kicks in. Without this, the Node process is happily
allocated up to ~1.5 GB on a 2 GB host, then the kernel OOM-kills it, and the
`restart: unless-stopped` loop starts a death-spiral.

### 4.3 [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh)

Add a new function `configure_swap()` that creates a 2 GB swap file if it does not exist
yet (idempotent: checks `/swapfile` first, skips if present). Called from `main()`
after `install_docker` so the swap is available before the first `docker compose up`.

The swap file is purely a safety net for the `do-agent` leak spikes — the cont
