# Reusable DatabaseModule and the fail-loud boot policy (AIS-56)

**Date:** 2026-10-21
**Story:** AIS-29 — schema-as-code migration workflow
**Subtask:** AIS-56 — reusable `DatabaseModule` (`DATABASE` provider + connection lifecycle)
**Plan:** [`2026-10-21--16-08-00-ais-56-database-module-plan.md`](../plans/2026-10-21--16-08-00-ais-56-database-module-plan.md)

## Problem / feature

After AIS-64 removed the call-back feature, the API had _no_ path to Postgres: the
`DATABASE` injection token and the `Database` type existed, but nothing provided
them. The next stories (`platform.api_keys` table, api-keys backend, admin pages)
all need one shared, testable way to obtain a database handle — and they must not
each re-implement `postgres()` wiring.

## Design rationale

| Decision                                                                 | Alternative rejected                                   | Why                                                                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Two tokens: `DATABASE` (Drizzle) + `DATABASE_CLIENT` (raw `postgres.js`) | One token holding the client                           | Closing the pool needs `client.end()`; the Drizzle handle does not expose it. Repositories see only `DATABASE` |
| Not `@Global()`                                                          | `@Global()` module                                     | Hidden dependency; the module graph should show who talks to the database                                      |
| `DATABASE_URL` read from `ConfigService`                                 | Re-using `database-url.ts` (dotenv/file probing)       | `ConfigModule` already loads the per-env files; the CLI helper would duplicate that inside the app             |
| Missing URL → `DatabaseConfigurationError` at boot                       | Warn and continue / fall back to nothing               | "Running without persistence" was precisely the AIS-64 problem. A deploy must fail visibly                     |
| Lazy connection (no socket at boot)                                      | Eager `SELECT 1` healthcheck at boot                   | A brief Postgres outage must not flap the API container; the first query reports the failure                   |
| Pool `max` = `DATABASE_POOL_MAX` (default 10)                            | Hard-coded pool                                        | Droplet memory budget; invalid values fall back instead of crashing                                            |
| Pure factories + injectable constructor seams                            | Direct `postgres()`/`drizzle()` calls inside providers | Lets the unit suite cover every branch with spies — no socket, no `DATABASE_URL`                               |

## Implementation

| File                                                                                  | Change                                                                                                                                                    |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/db/database.factory.ts`                                                 | New — `resolvePoolMax`, `readDatabaseUrl`, `createDatabaseClient`, `createDatabase`; depends on a structural `DatabaseEnvSource`, not on `@nestjs/config` |
| `apps/api/src/db/database.providers.ts`                                               | New — the two providers; the only file that imports `ConfigService`                                                                                       |
| `apps/api/src/db/database-lifecycle.service.ts`                                       | New — closes the client on shutdown (`timeout: 5`), logs and swallows failures, idempotent                                                                |
| `apps/api/src/db/database.module.ts`                                                  | New — exports `DATABASE` and `DATABASE_CLIENT`                                                                                                            |
| `apps/api/src/db/database.errors.ts`                                                  | New — `DatabaseConfigurationError`                                                                                                                        |
| `apps/api/src/db/database.const.ts`                                                   | Extended — `DATABASE_CLIENT`, `DATABASE_POOL_MAX_ENV`, `DEFAULT_DATABASE_POOL_MAX`                                                                        |
| `apps/api/src/app.module.ts`                                                          | Imports `DatabaseModule`                                                                                                                                  |
| `src/db/database.factory.spec.ts`, `src/db/database-lifecycle.service.spec.ts`, mocks | New — 24 tests total                                                                                                                                      |

## Outcome and how to verify

```bash
pnpm --filter @callback/api test          # 100 tests green
pnpm --filter @callback/api build
cd apps/api && APP_ENV=prod node dist/main.js
# expect: DatabaseConfigurationError (no DATABASE_URL) → exit 1

APP_ENV=prod DATABASE_URL=postgres://u:p@127.0.0.1:5432/db node dist/main.js
# expect: DatabaseModule initialized, /healthz 200,
#         on SIGTERM: "Postgres client closed."
```

Deviation from the plan: module-level specs were replaced by factory + lifecycle
specs, because the Jest ESM runner cannot load the CommonJS-only `@nestjs/config`
on Node 20 (same limitation the e2e suite already documents). DI-graph and
shutdown are covered by the manual boot check and `test:e2e`.

## Follow-ups

- AIS-39 must add `platform.apiKeys` to `schema.ts` — the handle is currently
  schema-aware but table-less, so `db.select().from(...)` has nothing to bind to.
- AIS-40 must `imports: [DatabaseModule]` and inject `DATABASE` (never the client).
- Health endpoint still does not probe the database; a read-only readiness check
  is a candidate for a later story.
