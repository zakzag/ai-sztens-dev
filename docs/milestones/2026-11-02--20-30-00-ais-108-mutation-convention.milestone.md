# AIS-108 — mutation convention: soft delete + optimistic concurrency

**Date:** 2026-11-02 20:30 (Europe/Budapest)
**Ticket:** AIS-108 · Plan: [`2026-11-02--20-30-00-ais-108-patch-delete-convention-plan.md`](../plans/2026-11-02--20-30-00-ais-108-patch-delete-convention-plan.md:1)
**Status:** implemented (2026-11-03) — change summary: [`docs/history/2026-11-03--00-45-00-ais-108-patch-delete-convention.md`](../history/2026-11-03--00-45-00-ais-108-patch-delete-convention.md:1)

## Problem / feature

The API could only create and read resources: the `api-keys` controller exposed `GET` and `POST` only, so no admin
screen could ever edit or retire a key. Concurrent editors had no protection — a second writer silently overwrote the
first. The contract also had no way to express “shape is fine, content is impossible”, so every semantic error was
flattened into `400 VALIDATION_FAILED`.

## Measured data / evidence

Audit of the current tree, not an assumption:

| Observation | Proof |
| --- | --- |
| no mutation routes | `ApiKeysController` declares `@Get`, `@Get(':identifier')`, `@Post` only |
| no `deleted_at` column | `apps/api/src/db/schema.ts` — `platform.api_keys` has `created_at`/`updated_at` only |
| no semantic code | `API_ERROR_CODE` has 10 entries; `422` is documented as “currently normalised to `VALIDATION_FAILED` → `400`” |
| reads ignore deletion state | `findPage` filters on `q` only; `findByIdentifier` on `identifier` only |

## Root cause / design rationale

Three alternatives were considered for each gap:

| Gap | Options | Chosen |
| --- | --- | --- |
| Concurrency | (a) read-compare-write in the service, (b) `ETag`/`If-Match`, (c) atomic `UPDATE … WHERE updated_at = $expected` | (c) — (a) leaves exactly the lost-update window the ticket closes; (b) is deferred by AIS-102 as a later step |
| Deletion | hard `DELETE`, soft delete, `410 Gone` | soft delete + `404` — keeps the audit trail and keeps the “invisible means absent” rule for clients |
| `422` | reuse `400`, or a dedicated code | dedicated `SEMANTIC_VALIDATION_FAILED`, so field mapping on the client can distinguish “fix the format” from “fix the value” |

`updatedAt` is the concurrency token because the column already exists and is maintained by Drizzle `$onUpdate`; the
value always comes from the database, the client's copy is only compared.

## Solution / implementation

| File | Change |
| --- | --- |
| `packages/shared/src/contract/error-code.const.ts` | `STALE_WRITE` (409), `SEMANTIC_VALIDATION_FAILED` (422) in the catalogue + status map |
| `packages/shared/src/contract/no-payload.schema.ts` (new) | `noPayloadSchema = z.null()` for the DELETE body |
| `packages/shared/src/contract/api-keys/api-keys.update.ts` (new) | `updateApiKeySchema`: partial fields + **required** `updatedAt`, `.strict()`, nullable clear-fields |
| `packages/shared/src/contract/api-keys/api-keys.contract.ts` | `apiKeys.update` (`PATCH`) and `apiKeys.remove` (`DELETE`) entries |
| `apps/api/src/db/schema.ts` | `deletedAt` column + index → migration `0003` |
| `apps/api/src/api-keys/api-keys.filter.ts` | `apiKeyNotDeletedFilter()` composed into every read |
| `apps/api/src/api-keys/api-keys.repository.ts` | `updateByIdentifier`, `softDeleteByIdentifier`, `findAnyByIdentifier` |
| `apps/api/src/common/http/app-error.ts` | `StaleWriteAppError`, `SemanticValidationAppError` |
| `apps/api/src/api-keys/api-keys.service.ts` | `update` (422 → atomic update → 404/409 classification), `remove` (404) |
| `apps/api/src/api-keys/api-keys.controller.ts` | `@Patch(':identifier')`, `@Delete(':identifier')`, DELETE returns `data: null` |
| `apps/api/src/common/openapi/zod-openapi.ts` | register `UpdateApiKey` and `NoPayload` components |

## Outcome and how to verify

End state: an edit carries its last known `updatedAt`; a stale one is refused (`409 STALE_WRITE` with
`details[0].path === 'updatedAt'`), a deleted key is indistinguishable from a missing one (`404`), and an impossible
value is a `422` instead of a `400`.

```bash
pnpm --filter @callback/api db:generate && pnpm --filter @callback/api db:migrate
pnpm --filter @callback/shared test && pnpm --filter @callback/api test
pnpm --filter @callback/api test:e2e
# manual: PATCH with a stale updatedAt must answer 409 STALE_WRITE
curl -s -X PATCH localhost:3000/api/api-keys/<id> -H 'content-type: application/json' \
  -d '{"name":"x","updatedAt":"2020-01-01T00:00:00.000Z"}'
```

**Measured on 2026-11-03 (Node v20.19.2):** `@callback/shared` 206 tests, `@callback/api` 431 tests, both green;
`test:e2e` 59 tests green with the `AppModule`-based suites self-skipping (Node < 24.9), lint and build clean, `knip`
exit `0`. The skipped `PATCH`/`DELETE` scenarios need Node ≥ 24.9 and the dev Postgres.

## Follow-ups

- `ETag`/`If-Match`, bulk mutation and idempotency keys — explicitly out of AIS-102 scope.
- Undelete endpoint / purge job for soft-deleted rows.
- `packages/api-client` `patch`/`delete` transport and the admin edit/delete UI (AIS-109 and later).
- The committed OpenAPI baseline (AIS-99) must be regenerated after this lands.
