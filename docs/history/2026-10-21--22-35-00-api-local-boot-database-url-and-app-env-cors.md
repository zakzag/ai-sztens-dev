# 2026-10-21 22:35 — Local API boot: missing `DATABASE_URL` + `APP_ENV` CORS trap

## Symptom

`pnpm dev` (API on the host, Postgres in Docker via `pnpm db:up`) aborted at boot:

```
ERROR [ExceptionHandler] DatabaseConfigurationError: DATABASE_URL is not set or blank.
Set it per environment (see docs/Specs/Database-Local.md §3 for local values);
the API refuses to start without a database configuration.
    at readDatabaseUrl (apps/api/src/db/database.factory.ts:84:11)
    at createDatabaseClient (apps/api/src/db/database.factory.ts:106:15)
    at InstanceWrapper.useFactory (apps/api/src/db/database.providers.ts:19:47)
```

## Diagnosis

Root cause: **`apps/api/.env.local` did not contain `DATABASE_URL`** — it only had
`PORT` and `CORS_ORIGINS`. The API reads its env files relative to `process.cwd()`
([`app.module.ts:26`](../../apps/api/src/app.module.ts:26)), i.e. `apps/api` when started via
`pnpm --filter @callback/api start:dev`, so that is the file that matters.

Candidates that were ruled out with evidence:

| Candidate | Evidence against |
|---|---|
| Postgres not running | `docker compose … ps` → `infra-postgres-1`, `Up 32 hours (healthy)`, `0.0.0.0:5432->5432` |
| Role / database / table missing | `psql -U aisztens -d aisztens_db` → `aisztens | aisztens_db`, `platform.__drizzle_migrations` + `platform.api_keys` exist |
| Blank value instead of a missing key | `findstr "^DATABASE_URL" apps/api/.env.local` → no match at all |
| Wrong env file selected | `APP_ENV` is unset → `normaliseAppEnv` falls back to `dev` → `envFilePath = ['.env.dev', '.env.local']`; `.env.dev` has no `DATABASE_URL` either, so the fallback file cannot mask the miss |
| cwd mismatch (`node dist/main` from the repo root) | the trace came from `nest start --watch`, whose cwd is `apps/api` |
| Prod `ignoreEnvFile: true` | only active when `APP_ENV=prod` |

Second, hidden defect found while verifying: with `APP_ENV` unset the API boots in **`dev`**
mode, so `.env.dev` wins and the CORS allow-list is the **droplet's**
(`https://web.aisztens.hu,…`). Differential proof against the running process:

```
OPTIONS /api/api-keys, Origin: https://admin.aisztens.hu → access-control-allow-origin: https://admin.aisztens.hu
OPTIONS /api/api-keys, Origin: http://localhost:5174      → (header absent, 204)
```

So even with the DB URL fixed, the admin SPA on `localhost:5174` would have failed with a
network error once AIS-41's page started calling the API.

## Fix

1. [`apps/api/.env.local`](../../apps/api/.env.local:1) — added the missing key (plus the note
   about where the password comes from):

   ```dotenv
   DATABASE_URL=postgres://aisztens:aisztens.l238!@localhost:5432/aisztens_db
   ```

   The password matches `AISZTENS_DB_PASSWORD` in `infra/.env.local` (the `!` is a legal
   userinfo character in a URI; only `@ : / ? # %` would need percent-encoding).

2. No code change. The CORS half is fixed by starting the local flow with `APP_ENV=local`
   (`set "APP_ENV=local" && pnpm dev`), which selects `.env.local` only and with it the
   localhost CORS list.

## Verification

```
set "APP_ENV=local" && pnpm --filter @callback/api start:dev

[Bootstrap] API up — APP_ENV=local (raw=local), listening on 0.0.0.0:3000,
CORS origins: http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174

GET /healthz                → 200 {"status":"oks","deployDate":null,"commitHash":null,…}
GET /api/api-keys           → 200 []
OPTIONS /api/api-keys
  Origin: http://localhost:5174 → 204 + access-control-allow-origin: http://localhost:5174
                                       + access-control-allow-methods: GET,HEAD,POST
```

The first (dev-mode) run also booted successfully with the same `DATABASE_URL` — the DB part of
the fix is independent of `APP_ENV`; only CORS depends on it.

## Docs updated

| File | Change |
|---|---|
| [`docs/Specs/Local-Development.md`](../Specs/Local-Development.md:4) | header date; §3 `.env.local` row now explains the `envFilePath` precedence; §5 gained the `pnpm dev` / `APP_ENV` pitfall with the three verification curls |
| [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md:87) | new §3.1: `DATABASE_URL is not set or blank` diagnosis steps and a symptom → cause → fix table |
| [`docs/milestones/2026-10-21--22-35-00-api-local-boot-database-url-and-cors.milestone.md`](../milestones/2026-10-21--22-35-00-api-local-boot-database-url-and-cors.milestone.md) | decision-grade summary |

## Follow-ups

* `pnpm dev` still leaves `APP_ENV` unset, so every developer must remember the export. The
  documented fix candidates: (a) set `APP_ENV=local` in the root `dev` script via `cross-env`
  (new dev dependency), or (b) change the `normaliseAppEnv` *unset* fallback from `dev` to
  `local`. (b) touches a deploy-adjacent default (a container without `APP_ENV` would then serve
  localhost CORS), so it needs a decision, not a silent commit. Until then the banner
  (`APP_ENV=…`) is the check: on a developer machine it must say `local`.
* The stale `nest start --watch` processes from the first attempt were killed; nothing is left
  listening on `:3000`.
