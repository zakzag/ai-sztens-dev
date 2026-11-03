# AIS-108 — update/delete convention implemented (`PATCH`, `DELETE`, `STALE_WRITE` 409, `SEMANTIC_VALIDATION_FAILED` 422)

**Date:** 2026-11-03 00:45 (Europe/Budapest)
**Ticket:** AIS-108 (subtask of AIS-102)
**Plan:** [`docs/plans/2026-11-02--20-30-00-ais-108-patch-delete-convention-plan.md`](../plans/2026-11-02--20-30-00-ais-108-patch-delete-convention-plan.md:1)
**Milestone:** [`docs/milestones/2026-11-02--20-30-00-ais-108-mutation-convention.milestone.md`](../milestones/2026-11-02--20-30-00-ais-108-mutation-convention.milestone.md:1)

---

## What changed

The `api-keys` resource became **mutable**: it can now be partially updated and soft-deleted, and two new failure
codes (`409 STALE_WRITE`, `422 SEMANTIC_VALIDATION_FAILED`) entered the shared catalogue so the server, the generated
OpenAPI document and the client all read one table.

### `packages/shared`

| File | Change |
| --- | --- |
| [`contract/error-code.const.ts`](../../packages/shared/src/contract/error-code.const.ts:1) | `STALE_WRITE` → `409`, `SEMANTIC_VALIDATION_FAILED` → `422` in `API_ERROR_CODE` **and** `API_ERROR_CODE_STATUS` |
| [`contract/no-payload.schema.ts`](../../packages/shared/src/contract/no-payload.schema.ts:1) (new) | `noPayloadSchema = z.null()` — the payload of a call with nothing to return |
| [`contract/api-keys/api-keys.update.ts`](../../packages/shared/src/contract/api-keys/api-keys.update.ts:1) (new) | `updateApiKeySchema`: partial fields, **required** `updatedAt`, `.strict()`, `nullable` clear-fields; `API_KEY_UPDATE_FORBIDDEN_FIELDS` |
| [`contract/api-keys/api-keys.contract.ts`](../../packages/shared/src/contract/api-keys/api-keys.contract.ts:1) | `apiKeys.update` (`PATCH`) and `apiKeys.remove` (`DELETE`) registry entries |
| [`contract/api-keys/api-keys.fixture.ts`](../../packages/shared/src/contract/api-keys/api-keys.fixture.ts:1) | `VALID_UPDATE_API_KEY_REQUEST` — the published example is the same value the tests parse |

### `apps/api`

| File | Change |
| --- | --- |
| [`db/schema.ts`](../../apps/api/src/db/schema.ts:1) | nullable `deleted_at` + `api_keys_deleted_at_idx` (migration `0003`); every timestamp narrowed to `timestamp(3)` (migration `0004`), see decision 6 |
| [`api-keys/api-keys.filter.ts`](../../apps/api/src/api-keys/api-keys.filter.ts:1) | `apiKeyNotDeletedFilter()` (`deleted_at IS NULL`) composed into every read/write |
| [`api-keys/api-keys.repository.ts`](../../apps/api/src/api-keys/api-keys.repository.ts:1) | `updateByIdentifier` (one atomic `UPDATE … WHERE updated_at = $expected RETURNING *`), `softDeleteByIdentifier`, `findAnyByIdentifier` (deleted rows included, used for miss classification) |
| [`api-keys/api-keys.logic.ts`](../../apps/api/src/api-keys/api-keys.logic.ts:1) (new) | pure `isPastDate(iso, now)` — the `422` rule, `now` injected |
| [`api-keys/api-keys.mapper.ts`](../../apps/api/src/api-keys/api-keys.mapper.ts:1) | `toApiKeyPatch` — omitted key = column untouched, explicit `null` = cleared |
| [`common/http/app-error.ts`](../../apps/api/src/common/http/app-error.ts:1) | `StaleWriteAppError`, `SemanticValidationAppError` (status derived from the catalogue) |
| [`api-keys/api-keys.service.ts`](../../apps/api/src/api-keys/api-keys.service.ts:1) | `update` (422 → atomic guard → 404/409 classification), `remove` (404 when nothing was live) |
| [`api-keys/api-keys.controller.ts`](../../apps/api/src/api-keys/api-keys.controller.ts:1) | `@Patch(':identifier')`, `@Delete(':identifier')`; `DELETE` answers `200` + `data: null` |
| [`common/openapi/zod-openapi.ts`](../../apps/api/src/common/openapi/zod-openapi.ts:1) | `UpdateApiKey` and `NoPayload` payload components registered |

## Decisions that shaped the implementation

1. **Atomic guard, not read-compare-write.** The version check lives in the `UPDATE`'s `WHERE`, so there is no window
   between the check and the write. A missed guard costs one extra read (`findAnyByIdentifier`) which decides between
   `404` (absent **or** deleted) and `409 STALE_WRITE` (live, other version).
2. **The route parameter stays `:identifier`** — the resource is already addressed by identifier, and the identifier
   itself is not patchable (renaming the address = delete + create).
3. **`422` before `409`.** An impossible payload (e.g. `expiresAt` in the past) is rejected before the version guard, so
   the retry advice stays correct. Boundary: `expiresAt === now` is allowed.
4. **`DELETE` is `200 { data: null }`**, never `204` (a `204` could not carry `meta.requestId`), described by
   `noPayloadSchema` → the `NoPayload` component.
5. **PATCH-only schemas live in new files**, so AIS-75's edits to `api-keys.schema.ts` do not collide.
6. **Millisecond timestamps (`timestamp(3)`).** The first *live* run of the new e2e block failed with `409 STALE_WRITE`
   on a **correct** `PATCH`. Root cause: `now()` stores microseconds (`…123456Z`) while `updatedAt` travels as
   `toISOString()` (`…123Z`), so the echoed token could never equal the stored value — the guard would have rejected
   every real update. The fix is on the storage side (migration `0004` narrows all four timestamp columns), not in the
   comparison: the database must not hold a value the wire contract cannot express. This was invisible on Node 20
   because the suite self-skipped there.

## Verification (run on 2026-11-03, **Node v26.0.0** `C:\Progs\nodejs` + dev Postgres)

> The first pass ran in a VSCode terminal whose `PATH` shadowed Node with a WebStorm-bundled **v20.19.2**
> (`…\WebStorm2025.2\zoocode-node\…`). On Node < 24.9 the `AppModule` e2e suites self-skip, which is exactly why the
> `STALE_WRITE` precision bug below stayed hidden. Re-run with `set "PATH=C:\Progs\nodejs;%PATH%"`.

| Command | Result |
| --- | --- |
| `pnpm --filter @callback/shared test` | **12 suites / 206 tests passed** |
| `pnpm --filter @callback/api test` | **39 suites / 433 tests passed** (incl. the timestamp-precision guards) |
| `pnpm --filter @callback/api test:e2e` | **11 suites / 59 tests passed**, nothing skipped — the `mutation convention` block ran against real Postgres: `PATCH` `200`, replayed `PATCH` `409 STALE_WRITE` + `details[0].path === 'updatedAt'`, past `expiresAt` `422`, `.strict()` `400`, `DELETE` → `data: null`, then `GET`/`PATCH`/second `DELETE` → `404`, deleted row absent from `total` |
| `pnpm --filter @callback/api lint` | clean (one pre-existing warning in `response-assert.logic.ts`, from AIS-98) |
| `pnpm --filter @callback/api build` | passes |
| `pnpm --filter @callback/admin test` | **23 files / 195 tests passed** (no admin change in this ticket) |
| `pnpm knip` | exit `0`, no unused exports/files |

Two lint errors were found and fixed during verification:

- `api-keys.repository.spec.ts` imported `buildUpdateApiKeyInput` without using it (the update specs assert
  column-level patches directly) — import removed;
- `schema.spec.ts` mapped over Drizzle's `index.config.columns`, which is typed `any`, so `@typescript-eslint`
  reported `no-unsafe-return` — the columns are now read through a narrow local view.

## Docs updated

- [`docs/Specs/API-Convention.md`](../Specs/API-Convention.md:1) — error-code table (`STALE_WRITE`, `SEMANTIC_VALIDATION_FAILED`), §4 empty-result rules, new **§4.2 Mutation convention** (`PATCH` rules, miss classification, soft delete, OpenAPI), §5 status list, recipe step 9, enforcement table, known gaps.
- [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md:1) — `0003` migration row + `deleted_at` / `api_keys_deleted_at_idx` note, `**Utolsó frissítés:**` refreshed.

## Follow-ups (deliberately not in this ticket)

- `packages/api-client` has no `patch`/`delete` transport yet (**AIS-109**), so the admin UI cannot call the new
  endpoints and a `422` / `409 STALE_WRITE` currently surfaces as a page `Alert` instead of a field error.
- `ETag`/`If-Match`, bulk mutations and idempotency keys stay out of the `updatedAt` convention.
- No undelete endpoint and no purge job for soft-deleted rows.
- The committed OpenAPI baseline (**AIS-99**) must be regenerated after this change.
- Run `pnpm --filter @callback/api test:e2e` on **Node ≥ 24.9 with the dev Postgres up** to execute the skipped
  `PATCH`/`DELETE` scenarios against the real database.
