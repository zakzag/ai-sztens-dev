# Milestone — field-level error mapping in the admin (AIS-95)

**Date:** 2026-10-28 · **Ticket:** AIS-95 (subtask of AIS-87) · **Spec:** `docs/Specs/API-Convention.md` §10.1

## 1. Problem / feature

Every failed write in the admin ended up as one generic sentence above the form. A duplicate
API-key identifier — a problem about a single input — looked identical to a `500`. The user had to
guess which field to fix, and the decision was made on the HTTP status, so any `409` (including one
added by a proxy) was reported as “identifier taken”.

## 2. Evidence

- `toIdentifierFieldError()` classified by `status === 409` and ignored `ApiError.issues[]`
  entirely (`apps/admin/src/features/api-keys/api-keys.logic.ts`, before the change).
- The server already sent the answer: `api-keys.service.ts` throws with
  `[{ path: 'identifier', message: … }]`, and `ZodBodyPipe` maps validator issues to the same shape.
- The admin tests could not express the path-driven cases: `createConflictError()` built no
  `issues[]`, and there was no multi-field factory.
- Plan `D11` tier 1 (“field”) was documented but unimplemented — only tiers 1 (page) and 2 existed
  in fact.

## 3. Design rationale

| Consideration                       | Alternative rejected                            | Why                                                                                                                                                                                                             |
| ----------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision key is the envelope `code` | Reacting to every 4xx with paths                | A field error claims “_this_ input is wrong”. Only `VALIDATION_FAILED` and `API_KEY_IDENTIFIER_CONFLICT` can honestly say that; a `500` or a proxy `409` cannot. Strict allow-list, everything else page-level. |
| Target input from `issues[].path`   | Parsing `details[]` strings (`"identifier: …"`) | `details` is a rendered projection for logs; parsing it would re-introduce the string matching that `D4` forbids.                                                                                               |
| Older server (`issues: []`)         | Downgrade to page alert                         | A duplicate identifier is about one input by definition; the code's default path keeps the correct highlight without a status check.                                                                            |
| First issue wins on duplicate paths | Last wins / concatenate                         | Server order is validator order, so the first is the deterministic, most specific one.                                                                                                                          |
| Copy from client constants only     | Rendering `issue.message`                       | It is English developer text; leaking it was an explicit DoD failure mode.                                                                                                                                      |

The mapping lives in a pure `*.logic.ts` function (`toFieldErrors`) returning
`{ fields, form }`, so the component contains no `status`/`code` inspection and every rule is unit
tested without a DOM.

## 4. Implementation

| File                                                                           | Change                                                                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `apps/admin/src/lib/error-message.const.ts`                                    | `API_KEY_IDENTIFIER_FIELD_MESSAGE`, `FIELD_INVALID_MESSAGE` — all Hungarian copy in one place.                  |
| `apps/admin/src/features/api-keys/api-keys.const.ts`                           | `API_KEY_FIELD_PATHS`, `FIELD_ERROR_CODES`, `DEFAULT_FIELD_PATH_BY_CODE`; conflict copy re-exported from `lib`. |
| `apps/admin/src/features/api-keys/api-keys.interface.ts`                       | `ApiKeyFormFieldName`, `ApiKeyFieldErrors`.                                                                     |
| `apps/admin/src/features/api-keys/api-keys.logic.ts`                           | `toFieldErrors()`; removed status-based `toIdentifierFieldError` / `isIdentifierConflict`.                      |
| `apps/admin/src/pages/api-keys/ui/ApiKeyForm.tsx`                              | Applies `fields` via `setError` in visual order, `form` via the page `Alert`.                                   |
| `apps/admin/src/pages/api-keys/api-keys.interface.ts`, `.../api-keys.const.ts` | `ApiKeyFormValues` and the field id/label/hint maps derived from the feature union.                             |
| `apps/admin/src/test/mocks/api-error.mock.ts`                                  | Path-aware conflict mock, legacy-conflict and multi-field factories.                                            |
| Tests (3 files)                                                                | 14 logic cases, 12 form cases, hook assertions migrated.                                                        |

## 5. Outcome and how to verify

A duplicate identifier now marks the `identifier` input (`aria-invalid` + Hungarian message under
it) and leaves the page alert empty; a multi-field `400` marks each input and puts only the
unmappable path in the alert; a `500` stays page-level and its text never appears in the DOM.

```
pnpm --filter @callback/admin test    # 101 tests green
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build
```

Manual check: log in to the admin, submit the API-key form twice with the same identifier — the
second attempt must show the message under the identifier input, with no alert above the form.

## 6. Follow-ups

- Tiers 3–4 (app banner, log drawer) still depend on the notification plan — tracked as AIS-96.
- The field→copy table is API-key specific; the next form (callback requests, company admin) must
  reuse `toFieldErrors` and only add its own field list, or the rule will be re-implemented.
- `422` still has no dedicated code; a semantic validation failure arrives as `VALIDATION_FAILED`/`400`.
