# AIS-34 — Drizzle ORM setup and local Docker Postgres

**Date:** 2026-10-19 (Europe/Budapest)
**Jira:** [AIS-34](https://zakzag.atlassian.net/browse/AIS-34) (first subtask of AIS-29)
**Mode:** code

## Summary

Implemented the first subtask of the DB schema-as-code story: added the
Drizzle ORM toolchain to the API and a standalone Dockerized Postgres for
local development.

## Changes

| File                                                                               | Change                                                                                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [`apps/api/package.json`](../../apps/api/package.json)                             | Added `drizzle-orm` + `postgres` runtime deps and `drizzle-kit` dev dep; added `db:generate`, `db:migrate`, `db:check` scripts |
| [`apps/api/drizzle.config.ts`](../../apps/api/drizzle.config.ts)                   | Drizzle Kit config: postgresql dialect, schema `src/db/schema.ts`, out `drizzle/`                                              |
| [`apps/api/src/db/schema.ts`](../../apps/api/src/db/schema.ts)                     | Placeholder schema (filled in by AIS-36)                                                                                       |
| [`apps/api/src/migrate.ts`](../../apps/api/src/migrate.ts)                         | Placeholder migration runner → `dist/migrate.js`                                                                               |
| [`apps/api/tsconfig.build.json`](../../apps/api/tsconfig.build.json)               | Excluded `drizzle.config.ts` from the Nest build                                                                               |
| [`infra/docker-compose.db.yml`](../../infra/docker-compose.db.yml)                 | Standalone Postgres-only compose file (host 5432, `pgdata_local` volume, init scripts, healthcheck)                            |
| [`package.json`](../../package.json)                                               | Root `db:up` / `db:down` scripts                                                                                               |
| [`apps/api/.env.example`](../../apps/api/.env.example)                             | Documented local `DATABASE_URL` (localhost:5432)                                                                               |
| [`apps/api/drizzle/meta/_journal.json`](../../apps/api/drizzle/meta/_journal.json) | Empty Drizzle migration journal (created by `db:generate`)                                                                     |

## Verification

- `pnpm --filter @callback/api db:generate` → "No schema changes" (exit 0)
- `pnpm --filter @callback/api db:check` → "Everything's fine" (exit 0)
- `pnpm --filter @callback/api build` → green
- `node apps/api/dist/migrate.js` → placeholder message (exit 0)
- `pnpm db:up` → Postgres healthy; init script created roles `aisztens`, `tkovari`, `krak`
- `pnpm --filter @callback/api lint` → clean

## Notes

- `pnpm --filter @callback/api test` currently fails with
  "Preset ts-jest/presets/default-esm not found relative to rootDir"
  (Jest 30 + ts-jest 29 preset resolution). This is pre-existing and
  unrelated to this change — the jest config block in
  [`apps/api/package.json`](../../apps/api/package.json) was not touched and
  the lockfile diff contains no jest/ts-jest version change. Out of scope
  for AIS-34 (its DoD requires only `build` green).
- [`infra/.env.local`](../../infra/.env.local) was created locally
  (gitignored) from [`infra/.env.example`](../../infra/.env.example) with
  local dev DB passwords so `pnpm db:up` can run.
