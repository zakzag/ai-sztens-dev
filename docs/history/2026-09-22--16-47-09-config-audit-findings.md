# Config / .env / Setup Audit — 2026-09-22

- Date: 2026-09-22
- Status: Audit complete (read-only)
- Scope: Every `.env`, `.env.example`, Docker Compose, deploy script, SSH key,
  tsconfig and supporting config in the repo.

## 1. Inventory

### `.env.example` files (5) — committed

| Path | Purpose |
|---|---|
| [`infra/.env.example`](../../infra/.env.example) | Runtime stack: domain, ACME, API, Postgres, monitor, CORS, webhook secret |
| [`apps/api/.env.example`](../../apps/api/.env.example) | API dev defaults (PORT, CORS_ORIGINS) |
| [`apps/web/.env.example`](../../apps/web/.env.example) | Frontend dev: VITE_API_BASE_URL |
| [`apps/admin/.env.example`](../../apps/admin/.env.example) | Admin dev: VITE_API_BASE_URL |
| [`deploy/.env.example`](../../deploy/.env.example) | Droplet config: HOST, SSH_USER, REMOTE_DIR, users, UFW |

### Real `.env` files (2) — present, gitignored

| Path | Status |
|---|---|
| [`infra/.env`](../../infra/.env) | Present, filled with `aisztens.hu` values |
| [`deploy/.env`](../../deploy/.env) | Present, but `HOST=` is empty |

### Missing `.env` files (3)

| Path | Notes |
|---|---|
| `apps/api/.env` | Not required at runtime (Docker sets `PORT`, `CORS_ORIGINS`, `DATABASE_URL`, `VAPI_WEBHOOK_SECRET`). Optional for local `pnpm dev`. |
| `apps/web/.env` | Same — only needed for local Vite dev. |
| `apps/admin/.env` | Same. |

### SSH public keys (`deploy/ssh-keys/`)

Present: `tkovari.pub`, `krak.pub`, `aisztens.pub`, `deployer.pub`.
Gitignored correctly (`*.pub`). `.pub.example` placeholders **are missing** —
the plan called for them, only real `.pub` files exist locally.

## 2. Configuration completeness check

### [`infra/.env`](../../infra/.env)

| Var | Value | Verdict |
|---|---|---|
| `DOMAIN` | `localhost` | Wrong for production; should be `aisztens.hu` (Caddy uses this for TLS + vhosts). |
| `ACME_EMAIL` | `ops@example.com` | Wrong — Let's Encrypt will email ops@example.com instead of you. |
| `API_PORT` | `3000` | OK |
| `CORS_ORIGINS` | `https://aisztens.hu,...` | OK (matches the domain pattern expected) |
| `VAPI_WEBHOOK_SECRET` | `change-me-vapi-secret` | **Placeholder — must be replaced** before VAPI integration. |
| `POSTGRES_DB` | `aisztens_db` | OK |
| `POSTGRES_USER` | `postgres` | OK |
| `POSTGRES_PASSWORD` | `postgres.238!` | OK (rotated, not the example placeholder) |
| `AISZTENS_DB_USER` | `aisztens` | OK |
| `AISZTENS_DB_PASSWORD` | `aisztens.238!` | OK |
| `TKOVARI_DB_PASSWORD` | `Sentinel.647` | OK |
| `KRAK_DB_PASSWORD` | `krak.238!` | OK |
| `MONITOR_TARGET_URL` | `http://api:3000/api` | OK |
| `MONITOR_INTERVAL_SECONDS` | `30` | OK |
| `MONITOR_ALERT_WEBHOOK_URL` | empty | Optional but recommended (Healthchecks.io / Slack / Discord). |
| `MONITOR_FAIL_THRESHOLD` | not in `.env.example`, defaulted by `docker-compose.yml` to `2` | OK (uses compose default) |
| `WEB_DIST_PATH`, `ADMIN_DIST_PATH` | left empty in compose | OK (commented out in compose) |

### [`deploy/.env`](../../deploy/.env)

| Var | Value | Verdict |
|---|---|---|
| `HOST` | **empty** | **Required** — first deploy will fail with `HOST:? Set HOST= in deploy/.env`. |
| `SSH_USER` | `root` | OK for first deploy |
| `REMOTE_DIR` | `/opt/aisztens` | **Inconsistent** — see finding A1 below. |
| `SUDO_USERS` | `tkovari,krak,deployer` | OK |
| `APP_USER` | `aisztens` | OK |
| `UFW_ENABLE` | `0` | OK (cloud firewall is on) |

## 3. Findings

### A. Critical (will break the next deploy)

1. **A1 — `REMOTE_DIR` mismatch.** [`deploy/.env`](../../deploy/.env) sets `REMOTE_DIR=/opt/aisztens`, but [`deploy/deploy.sh:29`](../../deploy/deploy.sh:29) and [`deploy/bootstrap.sh:11,19`](../../deploy/bootstrap.sh:11) hard-code `/opt/callback` (and the README at [`deploy/README.md:43`](../../deploy/README.md:43) references `/opt/callback`). On the first run:
   - `deploy.sh up` will `rsync` into `/opt/aisztens`,
   - but `bootstrap.sh` will look for SSH keys under `/opt/callback/deploy/ssh-keys` and fail with `WARNING: no public key at ...`.
   Fix: pick one path and align all three files (recommended: keep `/opt/aisztens` because the running app user is `aisztens`, then update both shell scripts and the README).

2. **A2 — `deploy/.env` has empty `HOST`.** First deploy will exit immediately. Fill in the droplet's public IPv4 or DNS hostname.

3. **A3 — `DOMAIN=localhost` in [`infra/.env`](../../infra/.env).** Caddy's automatic Let's Encrypt challenge will fail because `localhost` is not a public name. Set to the real domain (`aisztens.hu`).

4. **A4 — `ACME_EMAIL=ops@example.com`.** Must be a real mailbox that you monitor; Let's Encrypt sends expiry warnings there.

### B. Placeholders still unfilled (security risk if shipped)

1. **B1 — `VAPI_WEBHOOK_SECRET=change-me-vapi-secret`.** Rotate before wiring the VAPI webhook receiver (see [`apps/api/.env.example`](../../apps/api/.env.example) and the [`infra/.env.example:17`](../../infra/.env.example:17) comment).
2. **B2 — `MONITOR_ALERT_WEBHOOK_URL` is empty.** You'll only learn the API is down when an end user complains. Recommended: create a free Healthchecks.io probe and paste the ping URL.

### C. Documentation drift / minor

1. **C1 — `deploy/README.md` says `/opt/callback`** but [`deploy/.env.example:12`](../../deploy/.env.example:12) and the real [`deploy/.env`](../../deploy/.env) use `/opt/aisztens`. Update one to match the other.
2. **C2 — `docs/history/2026-09-18-droplet-deploy-infra-plan.md:41`** lists `infra/postgres/init/01-roles.sql`, but the actual file is [`infra/postgres/init/01-roles.sh`](../../infra/postgres/init/01-roles.sh) (bash wrapper around psql). Cosmetic only; fix the doc.
3. **C3 — `deploy/ssh-keys/.pub.example` placeholders are missing.** The README says only placeholders are committed, but the directory holds real `.pub` files. For a clean audit, replace with `<user>.pub.example` (gitignored: keep the real ones out of git) — or keep current behaviour and update the README wording.
4. **C4 — [`deploy/ssh-keys/README.md:18-22`](../../deploy/ssh-keys/README.md:18)** example uses `tkovari@callback` as comment; consistent with project. No action.
5. **C5 — `.vscode/settings.json` is empty.** Optional: add `"files.eol": "\n"` and `"typescript.tsdk": "node_modules/typescript/lib"` for consistency. Not a bug.
6. **C6 — Local `.env` files for apps are missing.** Not blocking — Docker Compose and `apps/api/.env.example` defaults are fine for `pnpm dev`. Create them only if you want to override `CORS_ORIGINS` locally.

### D. Already-good

- [`tsconfig.base.json`](../../tsconfig.base.json): `strict`, `noImplicitAny`, `strictNullChecks` all on. Coding rules satisfied.
- [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml): correct workspace globs and approved-build allowlist.
- [`infra/postgres/init/01-roles.sh`](../../infra/postgres/init/01-roles.sh): idempotent, uses psql variables, no hard-coded passwords.
- [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile): only serves what we need, redirects apex to `api.` subdomain when no static site is mounted.
- [`infra/monitor/watch.sh`](../../infra/monitor/watch.sh): exit-safe loops, fires `down` and `up` events, doesn't crash on missing webhook.
- All four `.pub` keys are present; `.gitignore` correctly excludes `*.pub`.

## 4. Recommended fix order

1. **Fix A1 + C1** together: decide `/opt/aisztens` vs `/opt/callback`; update [`deploy/deploy.sh:29`](../../deploy/deploy.sh:29), [`deploy/bootstrap.sh:11,19`](../../deploy/bootstrap.sh:11), [`deploy/README.md:43`](../../deploy/README.md:43), and the matching section in [`deploy/.env.example`](../../deploy/.env.example).
2. **Fill A2 (`HOST`)** in [`deploy/.env`](../../deploy/.env).
3. **Fix A3 + A4** in [`infra/.env`](../../infra/.env): set `DOMAIN=aisztens.hu`, `ACME_EMAIL` to a real address.
4. **B1**: generate a real `VAPI_WEBHOOK_SECRET` (e.g., `openssl rand -hex 32`) and update [`infra/.env`](../../infra/.env).
5. **B2**: register a Healthchecks.io probe and paste the URL into `MONITOR_ALERT_WEBHOOK_URL`.
6. **C2**: fix the `01-roles.sql` → `01-roles.sh` reference in the plan doc.
7. **C3 (optional)**: introduce `*.pub.example` placeholders and gitignore only real `*.pub` files.

## 5. Verification checklist

After applying the fixes, run from the repo root:

```bash
# 1. Compose config validates
docker compose --env-file infra/.env -f infra/docker-compose.yml config >/dev/null

# 2. Shell scripts parse
bash -n deploy/bootstrap.sh
bash -n deploy/deploy.sh
bash -n scripts/test/stack-smoke.sh

# 3. Dockerfile syntax (Docker required)
docker build -f infra/app/Dockerfile . --target build --progress=plain | head

# 4. JSON / YAML integrity
node -e "JSON.parse(require('fs').readFileSync('tsconfig.base.json'))"
node -e "JSON.parse(require('fs').readFileSync('package.json'))"
```

## 6. Out of scope (not part of this audit)

- VAPI integration / webhook receiver implementation (referenced in `VAPI_WEBHOOK_SECRET` but not yet wired in NestJS).
- PostgreSQL persistence in the API (still in-memory store; see [`apps/api/src/callback-requests/callback-requests.service.ts`](../../apps/api/src/callback-requests/callback-requests.service.ts)).
- Admin SPA auth (currently a no-op context).
- Frontend static builds (`apps/web/dist`, `apps/admin/dist`) — explicitly disabled in compose per the MVP scope.