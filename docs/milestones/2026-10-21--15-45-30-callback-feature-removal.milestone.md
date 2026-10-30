# Callback feature removal across API, admin, web and database (AIS-64)

**Date:** 2026-10-21
**Jira:** AIS-64 (Story) — subtasks AIS-65 (API), AIS-66 (DB), AIS-67 (admin), AIS-68 (docs), AIS-69 (web + shared)
**Plan:** [`2026-10-21--15-37-00-ais-64-callback-removal-plan.md`](../plans/2026-10-21--15-37-00-ais-64-callback-removal-plan.md)

## Problem / feature

The product direction changed: the call-back request vertical slice (public form →
API → in-memory store, plus an admin list and a planned Postgres table) is no longer
wanted. It had to be removed completely — API, database, admin UI, public web form,
shared contracts and living docs — while everything else (VAPI webhooks, health
endpoint, deploy stack, Drizzle migration workflow) stays.

## Evidence / starting state

| Item        | Fact before the change                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| API         | `GET/POST /api/callback-requests` served from an in-memory `Map`                                                        |
| Persistence | `DrizzleCallbackRequestsRepository` existed and was unit-tested but never wired (AIS-38 was still `To Do`)              |
| DB          | `callback.callback_requests` + `callback.call_status` created by migration `0000`                                       |
| Admin       | `DashboardPage` + `lib/api.ts` (raw `fetch`)                                                                            |
| Web         | `CallbackFormPage` + `ThankYouPage` + `lib/api.ts` POST to the API                                                      |
| Shared      | `createCallbackRequestSchema`, `CallbackRequest`, `CallStatus`                                                          |
| Infra       | `callback` schema created and granted by `01-roles.sh` / `02-schemas.sh`; smoke expected 3 schemas / 9 USAGE / 2 CREATE |
| Jira        | AIS-38 (callback persistence) became obsolete → cancelled; AIS-29 re-scoped to the DB workflow only                     |

## Root cause / design rationale

- **Application-role ownership.** The `aisztens` role owns the tables it creates via
  migrations, but **not** the schema (the bootstrap superuser does). A migration
  therefore cannot `DROP SCHEMA`; it can only drop objects. Decision: the generated
  migration drops the table and the enum, and the empty schema is removed on
  existing volumes by a one-off superuser command. Fresh volumes never create it.
- **Shared types forced a scope decision.** `apps/web` consumed the same Zod schema
  and types as the API, so deleting the API endpoint without touching the web app
  would leave a broken public form. The owner chose to remove the public form too.
- **Frontend foundation re-pointed.** The upcoming admin foundation (AIS-57) used
  the callback resource as its worked example; it now uses `api-keys` (AIS-39/40/41).

## Solution / implementation

| Area   | Change                                                                                                                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API    | Deleted `callback-requests/` module, repository + interface + errors + specs, callback mocks, `schema.spec.ts`; `CallbackRequestsModule` unregistered; `schema.ts` reduced to an empty, documented schema |
| DB     | New migration `drizzle/0001_square_kat_farrell.sql` (`DROP TABLE … CASCADE`, `DROP TYPE …`) + snapshot/journal; `callback` removed from `01-roles.sh`, `02-schemas.sh`                                    |
| Smoke  | Expected matrix updated to 2 schemas / 6 USAGE / 1 CREATE in `_postgres-init-schemas-test.sh` and `lib/20-cross-service.sh`                                                                               |
| Admin  | `DashboardPage`, `lib/api.ts`, „Kérések” nav removed; new `PlaceholderPage`; session key renamed to `aisztens-admin-token`                                                                                |
| Web    | `CallbackFormPage`, `ThankYouPage`, `lib/api.ts`, routes and both CTAs removed; `react-hook-form`, `@hookform/resolvers`, `zod` dropped from the web package                                              |
| Shared | Callback schema/types deleted, exports removed                                                                                                                                                            |
| Docs   | `Three-Env-Verification` (checks now use `/healthz`), `Database-Local` §9, `Infrastructure-Docker` §6.2, `Local-Development`, `Production-Runbook` §7                                                     |

## Outcome and how to verify

```bash
pnpm --filter @callback/api db:migrate       # 0001 applied, 2 rows in platform.__drizzle_migrations
docker exec infra-postgres-1 psql -U postgres -d aisztens_db \
  -At -c "SELECT nspname FROM pg_namespace WHERE nspname IN ('platform','email','callback')"
# expect: email, platform
docker exec infra-postgres-1 psql -U postgres -d aisztens_db \
  -At -c "SELECT to_regclass('callback.callback_requests')"
# expect: empty (NULL)

pnpm test                                    # shared 10 + api 74 tests green
pnpm --filter @callback/web build && pnpm --filter @callback/admin build
```

On an **existing** volume the empty schema needs the one-off operator step:

```bash
docker exec infra-postgres-1 psql -U postgres -d aisztens_db -c "DROP SCHEMA IF EXISTS callback"
```

## Follow-ups

- `pnpm lint` still reports 8 **pre-existing** errors in the two VAPI spec files
  (`jest` global type unresolved) — unrelated to this change, deserves its own task.
- `_postgres-init-schemas-test.sh` and `pnpm test:stack` were not executed in this
  environment (Docker-only); their expected values were updated but need a run.
- Next: AIS-56 (`DatabaseModule`), then AIS-39/40 (`platform.api_keys`), then the
  AIS-57 frontend foundation and AIS-41.
