# 2026-09-25 — Three-subdomain routing plan (api / web / admin on aisztens.hu)

## Goal

Serve three distinct subdomains from the single droplet `164.92.248.194`,
terminated by Caddy with automatic Let's Encrypt certs. `ssh.aisztens.hu`
remains a plain SSH endpoint and is **not** routed by Caddy.

| URL | Serves | Backing |
|---|---|---|
| `https://api.aisztens.hu/api/*` | NestJS API | `reverse_proxy api:3000` (internal Docker network) |
| `https://web.aisztens.hu/*` | Visitor call-back form SPA (static) | `root /srv/web` mounted from `apps/web/dist` |
| `https://admin.aisztens.hu/*` | Admin dashboard SPA (static) | `root /srv/admin` mounted from `apps/admin/dist` |
| `ssh.aisztens.hu:22` | OpenSSH | OS-level (unchanged) |

DNS A records for all four names already point at `164.92.248.194`
(confirmed by the user). No DNS work is required.

## Constraints (read from the source files)

1. The NestJS API sets a global `/api` prefix
   ([`apps/api/src/main.ts:16`](apps/api/src/main.ts:16)), so every HTTP
   endpoint lives at `/api/...`. From the SPA's point of view, the
   **API base URL is `https://api.aisztens.hu/api`**.
2. The API uses an explicit CORS allow-list driven by the
   `CORS_ORIGINS` env var
   ([`apps/api/src/main.ts:19`](apps/api/src/main.ts:19)).
   With `credentials: true` (line 25), the browser will reject any
   preflight whose `Access-Control-Allow-Origin` is not echoed exactly.
3. Both SPAs read `import.meta.env.VITE_API_BASE_URL` at build time and
   fall back to `'/api'` (which only works with the Vite dev proxy —
   [`apps/admin/src/lib/api.ts:3`](apps/admin/src/lib/api.ts:3),
   [`apps/web/src/lib/api.ts:4`](apps/web/src/lib/api.ts:4)).
   The production **build** therefore has to be compiled with
   `VITE_API_BASE_URL=https://api.aisztens.hu/api` injected into the
   environment. Otherwise the SPAs would POST to `https://admin.aisztens.hu/api`
   (which Caddy does not route anywhere) and the user would see a 404.
4. SPA routing requires `try_files {path} /index.html` so deep-links
   like `https://admin.aisztens.hu/callback-requests/123` resolve to
   the React entry point. Already shown in the commented-out example
   at [`infra/caddy/Caddyfile:34`](infra/caddy/Caddyfile:34).

## Required changes

### 1. `infra/.env`

```env
DOMAIN=aisztens.hu
CORS_ORIGINS=https://api.aisztens.hu,https://web.aisztens.hu,https://admin.aisztens.hu
```

The apex (`aisztens.hu`) is **not** in the CORS list because no SPA will
be served from the apex. If you ever decide to also mount the apps on
the apex, append it.

### 2. `infra/caddy/Caddyfile`

Replace the current `api.{env.DOMAIN}` + `{env.DOMAIN}` + commented-out
`admin.{env.DOMAIN}` with:

```caddy
{
    email {env.ACME_EMAIL}
    admin off
}

# Public API origin.
api.{env.DOMAIN} {
    encode zstd gzip
    reverse_proxy api:3000
}

# Public website (call-back form SPA).
web.{env.DOMAIN} {
    encode zstd gzip
    root * /srv/web
    try_files {path} /index.html
    handle /api/* {
        reverse_proxy api:3000
    }
}

# Admin dashboard SPA.
admin.{env.DOMAIN} {
    encode zstd gzip
    root * /srv/admin
    try_files {path} /index.html
    handle /api/* {
        reverse_proxy api:3000
    }
}

# Apex: redirect to the public website. Until a real landing page is
# mounted, this is the cleanest behaviour.
{env.DOMAIN} {
    redir https://web.{env.DOMAIN}{uri} 307
}
```

Notes:
- The `handle /api/*` blocks inside each SPA site are optional safety
  nets — the SPAs do not call same-origin `/api/...` in production
  (they call `https://api.aisztens.hu/api/...`). They exist so a
  developer pasting `https://admin.aisztens.hu/api/callback-requests`
  into a browser still gets a sensible response.
- Caddy needs `try_files` for SPA deep-links. Without it, refreshes on
  `/callback-requests/123` would 404.

### 3. `infra/docker-compose.yml`

Uncomment the SPA mounts on the `caddy` service (currently commented
out at lines 84–85):

```yaml
volumes:
    - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
    - caddy_data:/data
    - caddy_config:/config
    - ${WEB_DIST_PATH:-../apps/web/dist}:/srv/web:ro
    - ${ADMIN_DIST_PATH:-../apps/admin/dist}:/srv/admin:ro
```

`WEB_DIST_PATH` and `ADMIN_DIST_PATH` are already defined (defaulting
to `../apps/web/dist` and `../apps/admin/dist`) in
[`infra/.env.example:44`](infra/.env.example:44), so no new env vars
are required. The `infra/.env` for the droplet should keep those
defaults.

### 4. Build the SPAs before uploading

Vite embeds `VITE_API_BASE_URL` at **build** time, so the production
`apps/{web,admin}/dist/` must be rebuilt with the production URL. The
cleanest way is to make `deploy.sh` build before rsync'ing:

```bash
# in deploy.sh, before upload():
log "Installing dependencies ..."
(cd "$REPO_DIR" && pnpm install --frozen-lockfile)
log "Building web SPA ..."
(cd "$REPO_DIR" && pnpm --filter @callback/web build)
log "Building admin SPA ..."
(cd "$REPO_DIR" && pnpm --filter @callback/admin build)
```

Add `apps/*/dist/` and `deploy/.env` and `infra/.env` to the
`.gitignore` (the deploy script's rsync already excludes `dist`, so
nothing leaks). Actually — the existing rsync command already excludes
`dist`:

```bash
rsync -az --delete -e "${SSH_CMD[*]}" \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude 'coverage' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude 'deploy/.env' \
    --exclude 'infra/.env' \
    ...
```

That `--exclude 'dist'` needs to **stay**, but we need to **build
before rsync and re-include** the freshly built `dist/` only for the
two SPA apps. Two viable approaches:

**Option A (preferred): build, then rsync the SPAs separately.**

```bash
log "Building web + admin SPAs ..."
(cd "$REPO_DIR" && pnpm install --frozen-lockfile)
(cd "$REPO_DIR" && pnpm --filter @callback/web build)
(cd "$REPO_DIR" && pnpm --filter @callback/admin build)

# rsync the repo WITHOUT dist/ (current behaviour)
rsync ... --exclude 'dist' ... "$REPO_DIR/" "$SSH_USER@$HOST:$REMOTE_DIR/"

# then push the two dist/ folders explicitly
"${SSH[@]}" "mkdir -p $REMOTE_DIR/apps/web/dist $REMOTE_DIR/apps/admin/dist"
rsync -az -e "${SSH_CMD[*]}" "$REPO_DIR/apps/web/dist/" "$SSH_USER@$HOST:$REMOTE_DIR/apps/web/dist/"
rsync -az -e "${SSH_CMD[*]}" "$REPO_DIR/apps/admin/dist/" "$SSH_USER@$HOST:$REMOTE_DIR/apps/admin/dist/"
```

This preserves the current rsync safety (no stray dist/ leaks) and
makes the intent obvious in `deploy.sh`.

**Option B: build inside Docker.**
Add a multi-stage builder to `infra/app/Dockerfile` that also builds
the SPAs. More complex; no benefit for our setup since the build host
already has pnpm.

→ **Choose Option A.**

### 5. Provide `VITE_API_BASE_URL` for production builds

Two equally valid options:

**Option A (preferred): inline env into the build command in `deploy.sh`.**

```bash
VITE_API_BASE_URL="https://api.${DOMAIN}/api" \
  pnpm --filter @callback/web build
VITE_API_BASE_URL="https://api.${DOMAIN}/api" \
  pnpm --filter @callback/admin build
```

This reads `DOMAIN` from `deploy/.env`, which is already sourced by
`deploy.sh` (line 24). Keeps the production URLs out of source
control.

**Option B: ship a production `apps/{web,admin}/.env.production`** with
`VITE_API_BASE_URL=https://api.aisztens.hu/api`. Easier to inspect,
but couples the URL to a specific host in git.

→ **Choose Option A** (matches the current pattern of keeping
environment-specific values out of source).

### 6. Health endpoint for the API

The current API root controller ([`apps/api/src/app.controller.ts`](apps/api/src/app.controller.ts:1))
returns a plain string `getHello()`. With `setGlobalPrefix('api')`, it
becomes reachable at `https://api.aisztens.hu/api` (returns the
"Hello World" string). That is enough for the monitor
([`infra/monitor/watch.sh`](infra/monitor/watch.sh:1)) to poll, and
good enough for a manual `curl` smoke test.

If we want a structured JSON health response, add `@Get('healthz')`
returning `{ status: 'ok' }`. Nice-to-have, not blocking.

## Execution order

1. Update `infra/.env` on the droplet (`DOMAIN=aisztens.hu`,
   `CORS_ORIGINS=...`). For local testing, update the local `infra/.env`
   too.
2. Edit `infra/caddy/Caddyfile` per section 2.
3. Edit `infra/docker-compose.yml` per section 3 (uncomment volume
   mounts).
4. Edit `deploy/deploy.sh` per sections 4 + 5 (add build steps + pass
   `VITE_API_BASE_URL`).
5. Run `./deploy/deploy.sh up` locally. Verify on the droplet:
   - `docker compose exec caddy cat /etc/caddy/Caddyfile` shows literal
     `api.aisztens.hu`, `web.aisztens.hu`, `admin.aisztens.hu` blocks.
   - `curl -v https://api.aisztens.hu/api` returns 2xx.
   - `curl -v https://web.aisztens.hu/` returns 200 + HTML.
   - `curl -v https://admin.aisztens.hu/` returns 200 + HTML.
   - `docker compose logs caddy` shows LE cert issued for all three
     names.
   - Browser test: open `https://admin.aisztens.hu/`, check devtools →
     the SPA's `fetch(...)` to `https://api.aisztens.hu/api/...` succeeds
     with `200 OK` and `Access-Control-Allow-Origin` echoes the admin
     origin.

## Risks and known follow-ups

- **LE rate limit.** Caddy requests three new certs at first start. As
  long as the names are not in LE's per-week rate-limit window, this is
  fine.
- **`monitor` container crash.** Still in `Restarting (255)`. Out of
  scope for this plan — document as a separate follow-up.
- **`apps/admin` Auth.** The current
  [`apps/admin/src/auth/AuthContext.tsx`](apps/admin/src/auth/AuthContext.tsx:1)
  is not yet wired to a real auth flow. Out of scope for routing — but
  any future auth implementation must still work cross-origin (the
  admin SPA is on a different origin than the API).
- **SSH stays on `ssh.aisztens.hu:22`.** Nothing to change.

## Out-of-scope, mentioned for completeness

- `monitor` crash (`Restarting (255)`)
- Real authentication on `admin.aisztens.hu`
- HSTS preload / security headers (Caddy supports them out of the box
  but they're not in the current Caddyfile)
- Container log shipping / metrics endpoint
