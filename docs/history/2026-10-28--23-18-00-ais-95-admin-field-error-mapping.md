# AIS-95 — admin: code-first error mapping + `details[].path` → RHF field errors

**Date:** 2026-10-28
**Ticket:** <https://zakzag.atlassian.net/browse/AIS-95> (subtask of AIS-87)
**Plan:** `docs/plans/2026-10-28--23-11-00-ais-95-admin-code-first-error-mapping-field-errors-plan.md`
**Spec:** `docs/Specs/API-Convention.md` §10.1

## What was asked

The user must see the error on the input that is wrong, in Hungarian, instead of one generic
sentence above the form. The decision key is the envelope `code`; the target input is
`issues[].path`; the server's English `message` must never reach the screen.

## What already existed

`toErrorMessage()` already mapped `code → magyar szöveg` with a status fallback, and `ApiError`
already carried `code`, `requestId` and `issues[]`. Only the path → field half was missing, and the
form still classified failures by HTTP status (`toIdentifierFieldError` treated *any* `409` as a
duplicate identifier).

## What changed

| File | Change |
|---|---|
| `apps/admin/src/lib/error-message.const.ts` | Added `API_KEY_IDENTIFIER_FIELD_MESSAGE` (field-level duplicate copy) and `FIELD_INVALID_MESSAGE`; all Hungarian copy stays in this one file. |
| `apps/admin/src/features/api-keys/api-keys.const.ts` | New `API_KEY_FIELD_PATHS`, `FIELD_ERROR_CODES` (allow-list), `DEFAULT_FIELD_PATH_BY_CODE`; the old conflict constant is now a re-export of the lib copy. |
| `apps/admin/src/features/api-keys/api-keys.interface.ts` | New `ApiKeyFormFieldName` union and `ApiKeyFieldErrors { fields, form }`; hook doc updated. |
| `apps/admin/src/features/api-keys/api-keys.logic.ts` | `toFieldErrors()` replaces `toIdentifierFieldError()`; `isIdentifierConflict()` removed (no other caller). Pure helpers: code gate → issue collection → form fallback. |
| `apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx` | Applies `toFieldErrors`: one `setError` per mapped field (visual order → deterministic focus), `form` message to the page `Alert`; no status/code/message inspection left in the component. |
| `apps/admin/src/pages/api-keys/api-keys.interface.ts` | `ApiKeyFormValues` is now `Record<ApiKeyFormFieldName, string>`. |
| `apps/admin/src/pages/api-keys/api-keys.const.ts` | `API_KEY_FORM_FIELD_IDS` / `_LABELS` / `_HINTS` are exhaustive maps over `ApiKeyFormFieldName`. |
| `apps/admin/src/test/mocks/api-error.mock.ts` | `createConflictError()` now sends `issues[]`; new `createLegacyConflictError()` and `createMultiFieldValidationError()`. |
| `apps/admin/src/features/api-keys/api-keys.logic.test.ts` | Rewritten: 14 cases over every mapping branch. |
| `apps/admin/src/features/api-keys/use-api-keys.test.tsx` | Assertions moved from `toIdentifierFieldError` to `toFieldErrors`. |
| `apps/admin/src/pages/api-keys/ui/ApiKeyForm.test.tsx` | +5 component cases (legacy 409, multi-field 400, field-only failure, submit re-enabled, no 5xx text). |

## Behaviour rules (frozen in the spec)

1. **Strict code gate** — only `VALIDATION_FAILED` and `API_KEY_IDENTIFIER_CONFLICT` produce field errors; every other code stays a page `Alert`, paths or not.
2. **Default path** — an allowed code with `issues: []` uses its default path (`identifier`), so an older server still highlights the right input.
3. **Duplicate path** — first issue wins.
4. **Unmapped path** — becomes the single page-level sentence; mapped fields keep their own messages.
5. **Copy is client-owned** — `issue.message` / `details[]` are never rendered.

## Verification

```
pnpm --filter @callback/admin test    # 101 tests, 10 files
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build
```

All green. `toErrorMessage`'s signature is unchanged.
