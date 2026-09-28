# 2026-09-25 — Three-subdomain routing implementation

Implements the plan in
[`docs/history/2026-09-25-three-subdomain-routing-plan.md`](docs/history/2026-09-25-three-subdomain-routing-plan.md:1).
After this change + `./deploy/deploy.sh up`, the three subdomains serve
distinct apps over HTTPS from the same droplet:

| URL | Serves | Backing |
|---|---|---|
| `https://api.aisztens.hu/api/*` | NestJS API | Caddy `reverse_proxy` to `api:3000` |
| `https://web.aisztens.hu/*` | Visitor call-back form SPA | Caddy `root /srv/web` (mounted from `apps/web/dist`) |
| `https://admin.aisztens.hu/*` | Admin dashboard SPA | Caddy `root /srv/admin` (mounted from `apps/admin/dist`) |
| `ssh.aisztens.hu:22` | OpenSSH | unchanged |

## Files changed

### 1. [`infra/.env`](infra/.env:1)
- `DOMAIN=ssh.aisztens.hu` → `DOMAIN=aisztens.hu` (Caddy now requests LE
  certs for the real apex).
- `CORS_ORIGINS=...` trimmed to the three SPA origins that actually call
  the API: `https://api.aisztens.hu,https://web.aisztens.hu,https://admin.aisztens.hu`.
- Apex and `ssh.aisztens.hu` removed (no SPA, no HTTPS).

### 2. [`infra/caddy/Caddyfile`](infra/caddy/Caddyfile:1)
- The previously commented-out `admin.{env.DOMAIN}` block is now active.
- New `web.{env.DOMAIN}` block added with the same SPA shape
  (`root`, `try_files {path} /index.html`, `handle /api/*` safety net).
- The apex `{env.DOMAIN}` block now `redir`s to
  `https://web.{env.DOMAIN}{uri}` instead of bouncing to the API.
- All site blocks already use the `{env.DOMAIN}` native env-var
  substitution introduced in the previous fix
  ([`docs/history/2026-09-25-caddyfile-env-substitution-fix.md`](docs/history/2026-09-25-caddyfile-env-substitution-fix.md:1)).

### 3. [`infra/docker-compose.yml`](infra/docker-compose.yml:1)
- Uncommented the two static-frontend volume mounts on the `caddy`
  service:
  - `${WEB_DIST_PATH:-../apps/web/dist}:/srv/web:ro`
  - `${ADMIN_DIST_PATH:-../apps/admin/dist}:/srv/admin:ro`

### 4. [`deploy/deploy.sh`](deploy/deploy.sh:1)
- New `DOMAIN` variable read either from `deploy/.env` (if defined) or
  parsed from the local `infra/.env`. Falls back to `localhost`.
- New `build_spas()` function:
  - `pnpm install --frozen-lockfile`
  - Builds `@callback/web` and `@callback/admin` with
    `VITE_API_BASE_URL=https://api.${DOMAIN}/api` injected inline. Vite
    embeds `VITE_*` at build time, so the bundle hardcodes the cross-origin
    API URL.
- New `upload_dists()` function that rsyncs the freshly built
  `apps/{web,admin}/dist/` folders to the droplet (the main rsync keeps
  `--exclude 'dist'` so no other build artifacts leak).
- `upload()` now calls `build_spas` + `upload_dists` at the end, so both
  `deploy.sh upload` and `deploy.sh up` produce the right assets before
  the stack restarts.

## How the SPAs find the API (VITE_API_BASE_URL flow)

- `apps/web/src/lib/api.ts` and `apps/admin/src/lib/api.ts` read
  `import.meta.env.VITE_API_BASE_URL` at build time
  ([`apps/web/src/lib/api.ts:4`](apps/web/src/lib/api.ts:4),
  [`apps/admin/src/lib/api.ts:3`](apps/admin/src/lib/api.ts:3)).
- `deploy.sh` sets `VITE_API_BASE_URL=https://api.aisztens.hu/api`
  when invoking the build. The SPAs therefore POST to
  `https://api.aisztens.hu/api/callback-requests` directly — no proxy
  needed in production (the Vite dev proxy in `vite.config.ts` is for
  local development only).
- The API's CORS allowlist
  ([`apps/api/src/main.ts:19`](apps/api/src/main.ts:19)) is populated
  from `CORS_ORIGINS=https://api.aisztens.hu,https://web.aisztens.hu,https://admin.aisztens.hu`
  in `infra/.env`, so browser preflight requests from the two SPAs are
  accepted.

## Deployment steps

From the local WSL shell:

```bash
./deploy/deploy.sh up
```

The script will, in order:

1. Source `deploy/.env` and resolve `DOMAIN` (now `aisztens.hu`).
2. rsync the repo (excluding `dist/`, `.env`, `node_modules`, `.git`).
3. SCP `deploy/.env` and `infra/.env` on top.
4. **NEW:** `pnpm install --frozen-lockfile`.
5. **NEW:** Build `apps/web` and `apps/admin` with
   `VITE_API_BASE_URL=https://api.aisztens.hu/api`.
6. **NEW:** rsync `apps/web/dist/` and `apps/admin/dist/` to the droplet.
7. Run `docker compose --env-file infra/.env -f infra/docker-compose.yml up -d --build`
   on the droplet (rebuilds the API image, restarts everything, Caddy
   picks up the new Caddyfile + volume mounts).

## Verification on the droplet

After the deploy finishes, on the droplet:

```bash
cd /opt/aisztens/infra

# 1. All containers up
docker compose ps

# 2. Rendered Caddyfile has literal hostnames
docker compose exec caddy cat /etc/caddy/Caddyfile

# 3. TLS handshake + 2xx for all three subdomains
curl -v --max-time 10 https://api.aisztens.hu/api    2>&1 | tail -20
curl -v --max-time 10 https://web.aisztens.hu/       2>&1 | tail -20
curl -v --max-time 10 https://admin.aisztens.hu/     2>&1 | tail -20

# 4. Caddy obtained LE certs for all three names
docker compose logs --tail=100 caddy | grep -iE 'cert|obtain|renew|listen|error' || true

# 5. SPA bundles are mounted into the caddy container
docker compose exec caddy ls -la /srv/web /srv/admin
```

Expected:

1. `api`, `postgres`, `caddy`, `monitor` all `Up` and `healthy`/`running`.
2. `api.aisztens.hu`, `web.aisztens.hu`, `admin.aisztens.hu` literal
   site addresses (no `{$DOMAIN}` leftovers).
3. All three `curl` calls return 2xx with HTML / JSON.
4. Caddy logs show certificates issued for all three names
   (`obtained certificate`, `renewing certificate`).
5. `/srv/web` and `/srv/admin` contain `index.html`, `assets/`, etc.

Browser CORS smoke test:

1. Open `https://admin.aisztens.hu/` in Chrome.
2. Open DevTools → Network → trigger a request to
   `https://api.aisztens.hu/api/callback-requests`.
3. Confirm:
   - Status: 200 or 4xx (whichever the API returns), not blocked by CORS.
   - Response header `access-control-allow-origin: https://admin.aisztens.hu`.

## Known follow-ups (out of scope for this change)

- **Monitor container `Restarting (255)`.** Documented in
  [`docs/history/2026-09-25-caddyfile-env-substitution-fix.md`](docs/history/2026-09-25-caddyfile-env-substitution-fix.md:1).
- **Admin SPA authentication.** No real auth wired yet
  ([`apps/admin/src/auth/AuthContext.tsx`](apps/admin/src/auth/AuthContext.tsx:1)).
  Will need cross-origin-aware auth (cookie `SameSite=None; Secure` or
  bearer token) — note that with `credentials: true` the API echoes the
  origin, so cookies will work as long as they're set on
  `https://admin.aisztens.hu`.
- **Apex landing page.** Right now the apex redirects to
  `https://web.aisztens.hu/`. When a real marketing page exists, mount
  it under `/srv/landing` and update the apex block.