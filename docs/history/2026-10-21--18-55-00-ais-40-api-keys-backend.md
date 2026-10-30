# AIS-40 — api-keys backend endpoints (implementation)

**Jira:** AIS-40 (Subtask) — parent: AIS-30
**Date:** 2026-10-21
**Plan:** [`docs/plans/2026-10-21--18-25-00-ais-40-api-keys-backend-plan.md`](../plans/2026-10-21--18-25-00-ais-40-api-keys-backend-plan.md)
**Milestone:** [`docs/milestones/2026-10-21--18-55-00-api-keys-error-mapping.milestone.md`](../milestones/2026-10-21--18-55-00-api-keys-error-mapping.milestone.md)

## 1. What was built

A complete vertical slice for storing provider credentials in
`platform.api_keys`, from HTTP to Postgres:

| Method | Route                       | Behaviour                                                               |
| ------ | --------------------------- | ----------------------------------------------------------------------- |
| `GET`  | `/api/api-keys`             | 200, full list, `created_at DESC`                                       |
| `GET`  | `/api/api-keys/:identifier` | 200 single key, 404 when unknown                                        |
| `POST` | `/api/api-keys`             | 201 + created resource, 400 invalid payload, 409 duplicate `identifier` |

New files (all under [`apps/api/src/api-keys/`](../../apps/api/src/api-keys/)):

| File                                                                                               | Role                                                          |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [`api-keys.const.ts`](../../apps/api/src/api-keys/api-keys.const.ts)                               | DI token, route segment, DTO limits, `23505`, constraint name |
| [`api-keys.interface.ts`](../../apps/api/src/api-keys/api-keys.interface.ts)                       | `CreateApiKeyInput`, `ApiKeyResponse` (wire shapes)           |
| [`api-keys.errors.ts`](../../apps/api/src/api-keys/api-keys.errors.ts)                             | `ApiKeyIdentifierConflictError`, `ApiKeyRowMissingError`      |
| [`api-keys.error-guard.ts`](../../apps/api/src/api-keys/api-keys.error-guard.ts)                   | `isIdentifierConflict()` — walks the `cause` chain            |
| [`api-keys.mapper.ts`](../../apps/api/src/api-keys/api-keys.mapper.ts)                             | `toApiKeyResponse()`, `toNewApiKeyRow()`                      |
| [`api-keys.repository.interface.ts`](../../apps/api/src/api-keys/api-keys.repository.interface.ts) | Persistence contract                                          |
| [`api-keys.repository.ts`](../../apps/api/src/api-keys/api-keys.repository.ts)                     | `DrizzleApiKeysRepository`                                    |
| [`api-keys.service.ts`](../../apps/api/src/api-keys/api-keys.service.ts)                           | Orchestration + 404/409 translation                           |
| [`api-keys.controller.ts`](../../apps/api/src/api-keys/api-keys.controller.ts)                     | The three routes                                              |
| [`api-keys.module.ts`](../../apps/api/src/api-keys/api-keys.module.ts)                             | Binds the repository to the token, imports `DatabaseModule`   |
| [`dto/create-api-key.dto.ts`](../../apps/api/src/api-keys/dto/create-api-key.dto.ts)               | class-validator rules                                         |

Modified: [`app.module.ts`](../../apps/api/src/app.module.ts) (registers `ApiKeysModule`),
[`sql-expression.ts`](../../apps/api/src/db/test/helpers/sql-expression.ts) (new
`readSqlColumnNames()` helper), [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md)
(header + §9: the table now has a consumer).

Tests: 6 new spec files (`repository`, `service`, `controller`, `mapper`,
`error-guard`, `module`, `dto`) plus `test/api-keys.e2e-spec.ts`, and two mock
modules under `src/api-keys/test/mocks/`.

## 2. The bug the smoke test found

The first live round trip answered **500** for a duplicate identifier while every
unit test was green. Two facts the unit mock did not model:

1. Drizzle throws `DrizzleQueryError`; the SQLSTATE is on `error.cause`, not on
   the caught value.
2. `postgres.js` reports the violated constraint as `constraint_name`
   (not `constraint`).

`isIdentifierConflict()` now walks up to five `cause` levels and accepts both
field spellings. The mock grew `wrapDrizzleQueryError()` so this exact shape is
covered by unit tests (`api-keys.error-guard.spec.ts`, and the repository spec's
duplicate case now wraps the driver error).

## 3. Verification (actual output)

```text
pnpm --filter @callback/api build        → exit 0
pnpm --filter @callback/api test         → Test Suites: 19 passed; Tests: 194 passed
pnpm --dir apps/api exec eslint src/api-keys src/db/test/helpers test/api-keys.e2e-spec.ts → exit 0
pnpm --filter @callback/api test:e2e     → Test Suites: 5 passed; Tests: 23 passed
                                           (api-keys suite self-skips on Node 20.19.2, see §4)
```

Manual DoD smoke — real API (`pnpm start`, `DATABASE_URL` composed from
`infra/.env.local`) against the running `infra-postgres-1` container:

```text
create=201   {"id":"26953f87-…","identifier":"smoke-vapi","expiresAt":"2027-01-01T00:00:00.000Z",
              "createdAt":"2026-10-21T16:52:25.813Z","updatedAt":"…"}
lookup=200   same body
duplicate=409                       (was 500 before the error-guard fix)
create-new=201  description=null, expiresAt=null  ← omitted optional fields
invalid=400     identifier "smoke bad"
extra-field=400  id injected by the client
missing=404
list=200
```

Persistence, read straight from Postgres (not through the API):

```text
$ docker exec infra-postgres-1 psql -U aisztens -d aisztens_db -c \
    "SELECT identifier, name, description, expires_at, created_at FROM platform.api_keys ORDER BY created_at DESC"
  identifier   |     name     | description |       expires_at       |          created_at
---------------+--------------+-------------+------------------------+-------------------------------
 smoke-vapi-2 | Smoke Vapi 2 |             |                        | 2026-10-21 16:54:53.810842+00
 smoke-vapi   | Smoke Vapi   | smoke       | 2027-01-01 00:00:00+00 | 2026-10-21 16:52:25.813184+00
```

Both smoke rows were removed afterwards (`DELETE 2`), and the API process was
stopped, so the local database is back to its previous state.

## 4. Environment caveat (unchanged, but now explicit)

`test/api-keys.e2e-spec.ts` boots the real `AppModule`, which imports the
CommonJS-only `@nestjs/config`. Jest's ESM runner can only load that on
Node ≥ 24.9, so on the local Node 20.19.2 the suite prints
`[app-module-gate] skipped …` instead of failing — the same mechanism
`health.e2e-spec.ts` and `app-boot.e2e-spec.ts` already use. The HTTP contract
was therefore verified manually (§3) and will run unskipped in CI on a modern
Node.

## 5. Known limitations (deliberate)

| Limitation                           | Reason / follow-up                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Routes are unauthenticated           | Admin auth is a separate story (plan D13); they return the token value, so they must not be exposed publicly before that |
| `GET` list returns `api_key` in full | Masking/rotation is out of scope in the story and recorded in the milestone                                              |
| No pagination / search               | The table holds a handful of provider credentials                                                                        |
| No update/delete/rotation endpoints  | Not in the ticket scope (AIS-41 is read + create)                                                                        |
