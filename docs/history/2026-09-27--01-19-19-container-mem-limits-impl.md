# Impl: container mem_limits, swap, and Caddyfile template-render

- Date: 2026-09-26 (initial) / 2026-09-28 (corrected after server-side diagnosis)
- Status: Done
- Scope: Apply the plan in
  [`2026-09-26-container-mem-limits-after-oom-plan.md`](2026-09-26-container-mem-limits-after-oom-plan.md)
  plus the Caddyfile fix discovered by `docker logs` on the droplet.

## 1. What the plan originally thought was the cause

The user's `top` snapshot showed `kswapd0` at 50% CPU and the DigitalOcean
`do-agent` (`pnpm-native`) holding 615 MB. From that I concluded the system
was in OOM / swap-thrash and proposed a 2 GB droplet upgrade + container
`mem_limit`s + a 2 GB swap file.

## 2. What the droplet actually showed

Once the MCP SSH tunnel was available (the previous handshake timeouts were
transient network errors, NOT a wrong host — `ssh.aisztens.hu` IS the
DigitalOcean droplet), the real numbers were:

| Metric | Plan's assumption | Reality |
|---|---|---|
| Total RAM | "1 GB Basic, OOM-ing" | **961 MB total, 469 MB used, 491 MB available** |
| Swap | (not configured) | **0 B (none)** |
| `vmstat 1 3` swap in/out | "high si/so" | **si=0, so=0, swpd=0 — no swapping at all** |
| `do-agent` / `pnpm-native` | "memory leak on the host" | **process not present on the droplet** — the `pnpm-native` in `top` belongs to the GitHub Actions deploy runner, not the host |
| `api` container | "probably leaking" | **81.7 MB used** (well under any reasonable limit) |
| `postgres` container | "probably leaking" | **28.6 MB used** |
| `monitor` container | — | **5.3 MB used** |
| **`caddy` container** | "fine" | **`Restarting (1) 8 seconds ago`, 0 B RAM** — **crash-looping every ~8 s** |

The Caddy logs made the root cause unambiguous:

```
Error: adapting config using caddyfile: subject does not qualify for certificate: 'admin.{env.DOMAIN}'
```

repeating once per restart attempt. Caddy was matching `admin.{env.DOMAIN}`
literally as a site address, ACME was rejecting the host, Caddy was exiting,
and the `restart: unless-stopped` policy was spinning it up again — generating
all the `D`-state I/O wait and the `kswapd0` background activity that looked
like memory pressure in `top`.

The previous fix
([`2026-09-25-caddyfile-env-substitution-fix.md`](2026-09-25-caddyfile-env-substitution-fix.md))
believed Caddy resolves `{env.DOMAIN}` in site addresses. It does not — that
syntax only works inside certain Caddy *modules* (e.g. `root`, `header`),
not in the site-address slot itself. The TLS handshake error was masked by
the (then still functioning) single-subdomain `api.{$DOMAIN}` → `api.{env.DOMAIN}`
swap; adding the admin subdomain in the three-subdomain routing change
surfaced it.

## 3. Fix

### 3.1 [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile) — template

Rewritten so every host-driven value uses a render-time token instead of
Caddy's own placeholder syntax:

- `<DOMAIN>` for the apex domain (used in `api.<DOMAIN>`, `web.<DOMAIN>`,
  `admin.<DOMAIN>`, `<DOMAIN>`, `https://web.<DOMAIN>{uri}`).
- `<ACME_EMAIL>` for the Let's Encrypt contact address.

The opening comment explains why Caddy-side env-var placeholders were
abandoned: the previous `{$DOMAIN}` swap targeted a syntax that is only
valid inside `{}` blocks, and `{env.DOMAIN}` is silently ignored in site
addresses, causing the literal site `admin.{env.DOMAIN}` to crash the ACME
module on every boot.

Caddy's own request-time placeholders (`{path}`, `{uri}`, `{remote}`,
etc.) are left untouched — they live inside directives, not site addresses,
and `sed` does not match them.

### 3.2 [`deploy/deploy.sh`](../../deploy/deploy.sh) — `render_caddyfile()`

New function that:

1. Reads `DOMAIN` from `deploy/.env` or `infra/.env` (default `localhost`).
2. Reads `ACME_EMAIL` from the same source (default `admin@$DOMAIN`).
3. `sed -e 's|<DOMAIN>|…|g' -e 's|<ACME_EMAIL>|…|g'` over the template
   into `infra/caddy/Caddyfile.rendered`.
4. Asserts no `<DOMAIN>` / `<ACME_EMAIL>` token remains (cheap safety net).
5. SCPs the rendered file to the droplet under
   `infra/caddy/Caddyfile.rendered`.

`upload()` calls `render_caddyfile()` last (after `build_spas` and
`upload_dists`) so the rendered file is on the droplet by the time
`docker compose up` runs.

### 3.3 [`infra/docker-compose.yml`](../../infra/docker-compose.yml)

The `caddy` volume mount was switched from `./caddy/Caddyfile` to
`./caddy/Caddyfile.rendered`, with a comment block explaining why. The
template file is uploaded by the main `rsync`; the rendered file is
uploaded by `render_caddyfile()` and added to the rsync `--exclude` list so
we don't accidentally overwrite a freshly-rendered file with a stale one
from a previous local run.

### 3.4 [.gitignore](../../.gitignore)

`infra/caddy/Caddyfile.rendered` is added to `.gitignore`. It is generated
artefact, depends on the deploy environment, and must never be committed.

## 4. Secondary changes (mem limits + swap) — still applied

The plan's other conclusions were defensive in nature and remain valid,
even though they were not the root cause this time:

### 4.1 [`infra/docker-compose.yml`](../../infra/docker-compose.yml)

- `api` → `mem_limit: 400m`
- `postgres` → `mem_limit: 400m` + `POSTGRES_SHARED_BUFFERS=128MB`,
  `POSTGRES_EFFECTIVE_CACHE_SIZE=512MB`, `POSTGRES_WORK_MEM=4MB`
- `caddy` → `mem_limit: 64m`
- `monitor` → `mem_limit: 32m`

### 4.2 [`infra/app/Dockerfile`](../../infra/app/Dockerfile)

`ENV NODE_OPTIONS=--max-old-space-size=384` on the runtime stage so the V8
heap gives up before the 400 MB container limit fires.

### 4.3 [`deploy/bootstrap.sh`](../../deploy/bootstrap.sh)

`configure_swap()` (idempotent): creates a `${SWAP_SIZE_MB:-2048}` MB
`/swapfile`, registers it in `/etc/fstab`, sets `vm.swappiness=10` (also
persisted in `/etc/sysctl.conf`). The droplet currently has no swap at all,
and even though it has not been OOM-ing yet, a 961 MB host with no swap is
one memory spike away from an OOM-kill cascade.

## 5. Local verification

- `bash -n deploy/deploy.sh` → exit 0
- `bash -n deploy/bootstrap.sh` → exit 0
- `Get-Content infra/docker-compose.yml | grep Caddyfile.rendered` →
  `- ./caddy/Caddyfile.rendered:/etc/caddy/Caddyfile:ro`
- Local `sed` of the template with `DOMAIN=aisztens.hu`,
  `ACME_EMAIL=aisztens@gmail.com` produces a syntactically valid rendered
  Caddyfile (only the comment mentions of the placeholder names get
  substituted; this is cosmetic and harmless).

## 6. Deployment checklist

1. From WSL/Git Bash: `bash deploy/deploy.sh up`. This will:
   - rsync the repo (template-only for the Caddyfile).
   - Build the SPAs with `VITE_API_BASE_URL=https://api.aisztens.hu/api`.
   - Render `infra/caddy/Caddyfile.rendered` and SCP it to the droplet.
   - `docker compose up -d --build`.
2. On the droplet, verify the restart loop is gone:
   - `docker ps` → `caddy` should be `Up` (not `Restarting`).
   - `docker logs --tail=50 caddy` → must contain
     `obtained certificate` or `renewing certificate` for `api.aisztens.hu`,
     `web.aisztens.hu`, `admin.aisztens.hu`, `aisztens.hu`. **No more
     `subject does not qualify for certificate` lines.**
   - `docker stats --no-stream` → `caddy` RSS ≤ 64 MB, others ≤ their limit.
   - `free -h` → `total ≈ 961 Mi`, no swap yet (will be set up by `bootstrap.sh`
     in the next step).
3. Re-run `sudo bash deploy/bootstrap.sh` on the droplet so the new
   `configure_swap()` creates `/swapfile` (2 GB, swappiness=10).
4. Browser smoke test: `https://api.aisztens.hu/api`,
   `https://web.aisztens.hu/`, `https://admin.aisztens.hu/` all return 2xx.

## 7. Follow-ups

- The 1 GB Basic droplet is **still** tight for a NestJS + Postgres + Caddy
  stack under real traffic. The mem limits make it safe today, but if VAPI
  webhook volume grows or the DB grows beyond `shared_buffers=128MB`,
  consider upgrading to the 2 GB Basic tier ($12/month) — see
  [`2026-09-26-container-mem-limits-after-oom-plan.md`](2026-09-26-container-mem-limits-after-oom-plan.md)
  §3 for the memory budget.
- The previous
  [`2026-09-25-caddyfile-env-substitution-fix.md`](2026-09-25-caddyfile-env-substitution-fix.md)
  described a now-superseded understanding of Caddy placeholders. A
  correction note is added at the top of that file so future readers don't
  re-introduce `{env.DOMAIN}` in a site address again.
