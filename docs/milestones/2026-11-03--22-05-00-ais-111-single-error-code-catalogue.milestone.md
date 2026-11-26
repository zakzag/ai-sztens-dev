# AIS-111 — single error-code catalogue and generic field-error mapping

**Date:** 2026-11-03 22:05 (Europe/Budapest)
**Ticket:** AIS-111 (subtask of AIS-103)

## 1. Problem / feature

The admin app kept **two** hand-maintained `code → copy` tables (`ERROR_CODE_MESSAGE` for the
rendered sentence, `FIELD_SURFACE_CODES` for “may this code blame an input”) plus a third
re-export inside the `api-keys` feature. The failure→form mapping (`toFieldErrors`) lived in that
same feature, hard-wired to `API_KEY_FIELD_PATHS`, so every new resource would have copied it.

## 2. Measured data / evidence

`packages/shared/src/contract/error-code.const.ts` declares **13** codes; the admin
`ERROR_CODE_MESSAGE` had **11**. Missing: `STALE_WRITE` and `SEMANTIC_VALIDATION_FAILED`, both
added by AIS-108 after the admin table was written. Consequence: a `409 STALE_WRITE` (lost update)
rendered `CONFLICT_MESSAGE` — “the operation collides with an existing item” — instead of telling
the user to reload. Secondly, `toFieldErrors(new DOMException(…, 'AbortError'))` returned
`UNKNOWN_ERROR_MESSAGE` (“unexpected error”) although `toErrorSurface` classifies the same value as
`silent`, so a cancelled mutation painted an error after navigation.

## 3. Root cause / design rationale

The two tables were written by hand and nothing forced them to agree with the shared catalogue, so
a server-side addition silently degraded to status-based copy. The chosen fix is a **total record**
(`Record<ApiErrorCode, ApiErrorCodeCopy>`): TypeScript now rejects a new shared code until copy and
a field decision exist. Alternatives rejected: a lint script over string literals (cannot express
“one entry per code”), and a single flat `Record<string, string>` (loses the explicit
“never a field error” decision that `null` encodes).

For the mapping, the code→default-path rule (`409 API_KEY_IDENTIFIER_CONFLICT` → `identifier`) is
domain knowledge, so it stays in the feature and is passed in. The ticket's two positional
parameters became one target object (`fieldPaths`, `defaultPathByCode`) to stay extensible.

## 4. Solution / implementation

| File | Change |
| --- | --- |
| `apps/admin/src/lib/api-error-code.interface.ts` | **new** — `ApiErrorCodeCopy { message, fieldMessage \| null }` |
| `apps/admin/src/lib/api-error-code.const.ts` | **new** — `ERROR_CODE_CATALOGUE` (total record) + derived `ERROR_CODE_MESSAGE`, `FIELD_SURFACE_CODES` + `CLIENT_UNEXPECTED_PAYLOAD_CODE` |
| `apps/admin/src/lib/error-message.const.ts` | two new Hungarian copies (`STALE_WRITE_MESSAGE`, `SEMANTIC_VALIDATION_FAILED_MESSAGE`); hand-written table removed |
| `apps/admin/src/lib/error-message.ts` | imports the derived `ERROR_CODE_MESSAGE` |
| `apps/admin/src/lib/error-surface.const.ts` / `.logic.ts` | `FIELD_SURFACE_CODES` removed / re-imported; decision order unchanged |
| `apps/admin/src/features/api-keys/api-keys.const.ts` | `FIELD_ERROR_CODES` re-export removed; `DEFAULT_FIELD_PATH_BY_CODE` kept |
| `apps/admin/src/lib/field-errors.{interface,logic}.ts` | **new** — generic `toFieldErrors<F>(error, target)`; cancellation → silent, non-field code → page copy, `issues[]` → one message per owned path (first wins), empty issues → default path |
| `apps/admin/src/features/api-keys/api-keys.logic.ts` (+ test) | **deleted** (duplicate implementation) |
| `apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx` | calls the shared mapper with its field target |
| `apps/admin/src/lib/api-error-code.test.ts`, `field-errors.logic.test.ts` | **new** — exhaustiveness gate + 19 mapping cases |
| `apps/admin/src/test/mocks/api-error.mock.ts` | `createCancelledError()` added |
| `docs/Specs/UI-Architecture.md` | §4.1.1, §4.1.2, `lib` row, §9.3, date bumped |

Field-capable codes are now `VALIDATION_FAILED`, `SEMANTIC_VALIDATION_FAILED`,
`API_KEY_IDENTIFIER_CONFLICT`. `STALE_WRITE` is explicitly **not** field-capable: it blames
`updatedAt`, a hidden concurrency token the user cannot edit.

## 5. Outcome and how to verify

Adding an error code to `packages/shared` now breaks the admin build until it is given copy and an
explicit field decision; a 422 semantic error lands on the offending input; a lost update explains
itself and asks for a reload; a cancelled mutation renders nothing.

```powershell
pnpm --filter @callback/admin test      # 28 files / 239 tests
pnpm --filter @callback/admin build     # tsc --noEmit + vite
pnpm quality                            # layers (80 modules), knip, palette, field-errors: 0 violations
pnpm test                               # shared → api-client → ui → admin → api
```

Negative proof of the gate: delete the `STALE_WRITE` entry from `ERROR_CODE_CATALOGUE` — `tsc`
fails on the total record type and `api-error-code.test.ts` fails on the key set.

## 6. Follow-ups

- `AIS-74` (admin auth) and `AIS-115` (`useAppForm`) must consume `lib/field-errors.logic.ts`
  instead of adding their own mapping.
- `AIS-123` (docs) still owes `Forms-and-Validation.md`, which should link §4.1.2 rather than
  restate the rules.
- `ApiKeysTable`/`ApiKeysPage` are untouched: the generic list/table wiring is AIS-116 + the
  planned page rewire.
