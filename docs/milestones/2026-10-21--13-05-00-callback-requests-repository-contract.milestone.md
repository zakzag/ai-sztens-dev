# Callback requests repository contract and its unit tests

**Date:** 2026-10-21
**Jira:** AIS-37 (Subtask of AIS-29)
**Plan:** [`2026-10-21--12-54-00-ais-37-repository-unit-tests-plan.md`](../plans/2026-10-21--12-54-00-ais-37-repository-unit-tests-plan.md)
**History:** [`2026-10-21--13-05-00-ais-37-repository-unit-tests.md`](../history/2026-10-21--13-05-00-ais-37-repository-unit-tests.md)

## Problem / feature

AIS-36 delivered the Drizzle schema and the first migration, so `callback.callback_requests`
exists in Postgres. Nothing could read or write it yet: the API still used an in-memory `Map`,
and there was no persistence abstraction to unit-test. AIS-37 adds that abstraction — the
repository — plus the DB-free test suite that locks its behaviour in place before AIS-38 wires it
into the application.

## Design rationale

| Decision                                                        | Alternative                                    | Why this one                                                                                                              |
| --------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Repository returns rows (`CallbackRequestRow`)                  | Return the shared `CallbackRequest` view model | Row → JSON mapping (`Date` → ISO string) is a service concern; the DB layer must not know the HTTP contract               |
| `findOne` throws `CallbackRequestNotFoundError`                 | Return `null`                                  | Explicit failure at every call site; `null` is easy to ignore. The DB layer still never throws a Nest `NotFoundException` |
| Invalid UUID rejected locally (`InvalidCallbackRequestIdError`) | Let Postgres answer with `22P02`               | Deterministic, free, and no confusing driver error in the logs                                                            |
| Driver errors propagate untouched                               | Wrap into a `PersistenceError` with `cause`    | Callers (AIS-38) must still be able to classify driver errors; wrapping would hide them                                   |
| `findAll` is `created_at DESC` by contract                      | Leave ordering to callers                      | Paging/listing in later stories starts from a deterministic sequence                                                      |
| Depend on a `Database` type alias + `DATABASE` token            | Inject a concrete `drizzle(...)` result        | Enables a mock handle in tests and one provider in AIS-38 (dependency inversion)                                          |

## Implementation

| File                                                                   | One-line change                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/api/src/db/database.interface.ts`                                | `Database` type over the schema (the injected abstraction)    |
| `apps/api/src/db/database.const.ts`                                    | `DATABASE` injection token                                    |
| `apps/api/src/db/callback-requests.errors.ts`                          | `NotFound` / `InvalidId` / `NotPersisted` custom errors       |
| `apps/api/src/db/uuid.ts`                                              | Pure `isUuid()` guard                                         |
| `apps/api/src/db/callback-requests.repository.interface.ts`            | `CallbackRequestsRepository` contract                         |
| `apps/api/src/db/callback-requests.repository.ts`                      | Drizzle implementation (`create`, `findAll`, `findOne`)       |
| `apps/api/src/db/test/mocks/*.mock.ts`                                 | Row fixtures + scripted Drizzle handle                        |
| `apps/api/src/db/callback-requests.repository.spec.ts`, `uuid.spec.ts` | 14 + 18 unit tests, no database                               |
| `apps/api/package.json`                                                | `@jest/globals` devDependency (ESM Jest has no `jest` global) |
| `apps/api/tsconfig.build.json`                                         | Exclude `**/test/**` from the production build                |
| `docs/Specs/Database-Local.md`                                         | §9 status tables + last-updated date                          |

## Outcome and how to verify

```bash
pnpm --filter @callback/api test         # 12 suites / 107 tests, all green (was 10 / 93)
pnpm --filter @callback/api build        # OK
pnpm --dir apps/api exec eslint src/db   # 0 problems
```

The tests need **no** `DATABASE_URL`, no running Postgres and no network — every query chain is
scripted in `src/db/test/mocks/database.mock.ts`. The end state after AIS-37: the persistence
layer exists and is tested, but the API still serves from the in-memory `Map`
(`docker exec … select count(*) from callback.callback_requests` stays `0` during API testing).

## Follow-ups

- AIS-38: `database.module.ts` provider (`postgres.js` client + `onModuleDestroy`), module
  wiring, `Map` removal, error → HTTP mapping, and the e2e proof (POST → row survives restart).
- Replace the remaining global-`jest` usages so `pnpm --filter @callback/api lint` can be green.
- The `ORDER BY created_at DESC` direction is asserted structurally here; the SQL text is
  verified by the AIS-38 integration run.
