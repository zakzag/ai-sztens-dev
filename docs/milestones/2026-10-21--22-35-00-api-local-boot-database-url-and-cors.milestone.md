# Milestone — local API boot: `DATABASE_URL` missing, `APP_ENV` defaults to `dev`

**Date:** 2026-10-21 22:35
**Scope:** local developer workflow (`pnpm dev` host-run API + `pnpm db:up` Docker Postgres)
**Symptom:** `DatabaseConfigurationError: DATABASE_URL is not set or blank` at boot

## 1. Problem / feature

The API refused to start on the developer machine. The error is intentional (AIS-56 D5: loud
failure instead of running without persistence), so the question was **which** configuration input
was missing, not whether the check is right. A second defect surfaced while verifying: the API
booted with the **droplet's** CORS allow-list, which would have blocked the admin SPA
(`http://localhost:5174`) once it started calling the API.

## 2. Measured data / evidence

| Check                                                        | Result                                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `docker compose … ps`                                        | `infra-postgres-1`, `Up 32 hours (healthy)`, `5432->5432`                                                       |
| `psql -U aisztens -d aisztens_db`                            | `aisztens                                                                                                       | aisztens_db`; `platform.__drizzle_migrations`, `platform.api_keys` present |
| `findstr "^DATABASE_URL" apps\api\.env.local`                | no match (file had only `PORT`, `CORS_ORIGINS`)                                                                 |
| Boot banner, `APP_ENV` unset                                 | `APP_ENV=dev (raw=(unset, defaulted to dev)) … CORS origins: https://web.aisztens.hu,https://admin.aisztens.hu` |
| `OPTIONS /api/api-keys`, `Origin: https://admin.aisztens.hu` | `access-control-allow-origin: https://admin.aisztens.hu`                                                        |
| `OPTIONS /api/api-keys`, `Origin: http://localhost:5174`     | **header absent**, `204`                                                                                        |

## 3. Root cause

- `apps/api/.env.local` was created with only `PORT` and `CORS_ORIGINS`; `DATABASE_URL` was never
  added. NestJS resolves env files from `process.cwd()` (`apps/api` for `start:dev`), so that file
  is the only place the value can come from.
- `APP_ENV` is unset, and [`normaliseAppEnv()`](../../apps/api/src/config/app-env.ts:48) falls back
  to `dev`. `envFilePath` therefore becomes `['.env.dev', '.env.local']`, and since
  `@nestjs/config` never lets a later file override an earlier one, `.env.dev`'s
  `CORS_ORIGINS` (droplet origins) wins over the localhost list in `.env.local`. The fallback to
  `dev` was written for the containerised local stack (`scripts/dev-stack.sh` exports
  `APP_ENV=local`); the later, host-run `pnpm dev` path never sets it.
- Alternatives ruled out: Postgres down (healthy), role/db/table missing (all present), blank value
  (key absent), cwd mismatch (the trace came from `nest start --watch`, cwd `apps/api`), prod
  `ignoreEnvFile` (only `APP_ENV=prod`).

## 4. Solution / implementation

| File                                                                         | Change                                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/api/.env.local`](../../apps/api/.env.local:1)                         | added `DATABASE_URL=postgres://aisztens:aisztens.l238!@localhost:5432/aisztens_db` (password = `AISZTENS_DB_PASSWORD` from `infra/.env.local`) and a comment on why the API cannot boot without it |
| [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md:4) | header date; §3 `.env.local` row explains the `envFilePath` precedence; §5 gained the `pnpm dev` / `APP_ENV` pitfall + verification curls                                                          |
| [`docs/Specs/Database-Local.md`](../../docs/Specs/Database-Local.md:87)      | new §3.1 with the diagnosis sequence and a symptom → cause → fix table                                                                                                                             |

No application code changed: the missing key is machine-local configuration, and the CORS half is
a start-command issue (`APP_ENV=local`), not a code bug.

## 5. Outcome and how to verify

```bash
set "APP_ENV=local" && pnpm dev        # cmd;  PowerShell: $env:APP_ENV='local'; pnpm dev

# expect in the boot banner:
#   [Bootstrap] API up — APP_ENV=local (raw=local), ..., CORS origins: http://localhost:5173,...

curl -s -w '\n%{http_code}\n' http://localhost:3000/healthz       # 200 {"status":"oks",…}
curl -s -w '\n%{http_code}\n' http://localhost:3000/api/api-keys  # 200 [] or rows
curl -s -D - -o NUL -X OPTIONS http://localhost:3000/api/api-keys \
  -H "Origin: http://localhost:5174" -H "Access-Control-Request-Method: GET" \
  | grep -i access-control-allow-origin    # must echo http://localhost:5174
```

All four were confirmed on 2026-10-21 22:33 (banner `APP_ENV=local`, `healthz` 200, `api-keys` 200
`[]`, ACAO echoed).

## 6. Follow-ups

- `pnpm dev` still leaves `APP_ENV` unset. Two candidate fixes, both needing a decision:
  add `cross-env` and set `APP_ENV=local` in the root `dev` script, or change the **unset**
  fallback of `normaliseAppEnv` from `dev` to `local` (deploy-adjacent: a container without
  `APP_ENV` would then serve the localhost CORS list).
- `.env.dev` sitting on a developer machine is what makes the `dev` fallback dangerous; consider
  a boot warning when `APP_ENV !== 'local'` and the CORS list contains no localhost origin.
