# Milestone: Caddy restart-loop & container mem_limits

- **Date**: 2026-09-28
- **Severity**: Critical — full HTTPS stack was unreachable; droplet appeared unresponsive.
- **Host**: `ssh.aisztens.hu` (DigitalOcean droplet, 1 vCPU / 961 MB RAM / 25 GB SSD).

## 1. Problem

After the latest deploy the user reported a slow server. `top` showed
`kswapd0` at 50% CPU and a `pnpm-native` process under user `do-agent`
holding 615 MB. All four Docker containers looked idle.

## 2. Measured data (from the droplet, after MCP SSH came up)

| Metric | Value | Read as |
|---|---|---|
| `Mem.total` | 961 MiB | Small droplet, but |
| `Mem.available` | **491 MiB** | >50% free, **no OOM** |
| `Swap` | 0 B | No swap at all |
| `vmstat 1 3` (`si/so/swpd`) | **0 / 0 / 0** | **No active swapping** |
| `docker stats` (`api`) | 81.7 MiB / 961.5 MiB | Normal |
| `docker stats` (`postgres`) | 28.6 MiB / 961.5 MiB | Normal |
| `docker stats` (`monitor`) | 5.3 MiB / 961.5 MiB | Normal |
| `docker stats` (`caddy`) | **0 B / 0 B** | **Not running — restart-loop** |
| `docker ps` (`caddy`) | `Restarting (1) 8 seconds ago` | Crash-looping every 8 s |
| `do-agent` / `pnpm-native` on host | **not present** | The `top` row was the GitHub Actions deploy runner, not a host process |
| `docker logs caddy` | `Error: adapting config using caddyfile: subject does not qualify for certificate: 'admin.{env.DOMAIN}'` | Root cause |

## 3. Root cause

The Caddy container's `restart: unless-stopped` policy was spinning it up
every 8 s because the Caddyfile used `{env.DOMAIN}` in **site-address
positions**, where Caddy does not substitute env-var placeholders. ACME
rejected the literal host `admin.{env.DOMAIN}` with `subject does not
qualify for certificate`, Caddy exited, Docker restarted it. The
boot-loop drove all the `D`-state I/O wait and the `kswapd0` background
activity that looked like memory pressure in `top`.

The earlier history file
[`docs/history/2026-09-25-caddyfile-env-substitution-fix.md`](../history/2026-09-25-caddyfile-env-substitution-fix.md)
asserted Caddy resolves `{env.DOMAIN}` in site addresses. It does not —
the syntax only works inside certain Caddy *modules* (e.g. `root`,
`header`). That history file is now marked `SUPERSEDED` at the top.

## 4. Solution / implementation

The real fix is to render the Caddyfile at deploy time so the running
container always sees literal hostnames. As defensive hardening (not
strictly required for this bug), `mem_limit` and a swap file were added
so a single runaway container cannot starve the host again.

| File | Change |
|---|---|
| [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile) | Template with `<DOMAIN>` and `<ACME_EMAIL>` tokens instead of Caddy placeholders. |
| [`infra/caddy/Caddyfile.rendered`](../../infra/caddy/Caddyfile.rendered) | New generated file, gitignored, mounted into the Caddy container. |
| [`deploy/deploy.sh`](../../deploy/deploy.sh) | New `render_caddyfile()` function — reads `DOMAIN`/`ACME_EMAIL` from `deploy/.env` or `infra/.env`, runs `sed -e 's\|<DOMAIN>\|…\|g' -e 's\|<ACME_EMAIL>\|…\|g'`, sanity-checks no placeholder remains, SCPs the rendered file to the droplet. `upload()` calls it after `build_spas`/`upload_dists`. |
| [`infra/docker-compose.yml`](../../infra/docker-compose.yml) | Caddy volume mount changed from `./caddy/Caddyfile` to `./caddy/Caddyfile.rendered`. Added `mem_limit` per service: `api 400m`, `postgres 400m`, `caddy 64m`, `monitor 32m`. Added `POSTGRES_SHARED_BUFFERS=128MB`, `POSTGRES_EFFECTIVE_CACHE_SIZE=512MB`, `POSTGRES_WORK_MEM=4MB`. |
| [`infra/app/Dockerfile`](../../infra/app/Dockerfile) | `ENV NODE_OPTIONS=--max-old-space-size=384` in runtime stage — V8 heap gives up before the 400 MB container limit fires. |
| [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh) | New idempotent `configure_swap()` — creates a `${SWAP_SIZE_MB:-2048}` MB `/swapfile`, registers it in `/etc/fstab`, sets `vm.swappiness=10`. Called from `main()` before `install_docker`. |
| [`.gitignore`](../../.gitignore) | Added `infra/caddy/Caddyfile.rendered`. |
| [`docs/history/2026-09-25-caddyfile-env-substitution-fix.md`](../history/2026-09-25-caddyfile-env-substitution-fix.md) | `⚠ SUPERSEDED 2026-09-28` notice prepended. |

## 5. Outcome & how to verify

Hotfix applied on the droplet:

```bash
sed -i 's|admin.{env.DOMAIN}|admin.aisztens.hu|g; ...' \
  /opt/aisztens/infra/caddy/Caddyfile
cd /opt/aisztens/infra && docker compose restart caddy
```

Result (verified via MCP SSH):

| Check | Before | After |
|---|---|---|
| `docker ps caddy` | `Restarting (1) 8 seconds ago` | `Up 54 seconds` |
| `docker logs caddy` | `subject does not qualify for certificate: 'admin.{env.DOMAIN}'` (×∞) | `obtained certificate` / `renewing certificate` for `api.aisztens.hu`, `web.aisztens.hu`, `admin.aisztens.hu`, `aisztens.hu` |
| `curl http://127.0.0.1/` | connection refused | `http_code=308` (HTTP→HTTPS) |
| `uptime` load average | 0.22, 0.12, 0.09 | **0.02, 0.07, 0.07** |

Local checks that pass: `bash -n deploy/deploy.sh`, `bash -n deploy/bootstrap.sh`,
the `sed` template render produces a syntactically valid Caddyfile with
`OK: no placeholders remain`.

To finish the hardening on the next deploy: run `bash deploy/deploy.sh up`
locally (will rerender the Caddyfile and pick up the new `mem_limit`s),
then `sudo bash deploy/bootstrap.sh` on the droplet to create the 2 GB swap.

## 6. Follow-ups

- The 961 MB droplet is still tight. If VAPI webhook volume grows or the
  DB grows past `shared_buffers=128MB`, upgrade to the 2 GB Basic tier
  ($12/month) per
  [`docs/history/2026-09-26-container-mem-limits-after-oom-plan.md`](../history/2026-09-26-container-mem-limits-after-oom-plan.md) §3.
- ACME challenge for `api.aisztens.hu`/`admin.aisztens.hu` reports
  `Timeout during connect (likely firewall problem)` — likely a DigitalOcean
  Cloud Firewall rule blocking outbound TCP from the challenge endpoint.
  Separate from this milestone, but worth checking if TLS issuance never
  completes for those two names.
