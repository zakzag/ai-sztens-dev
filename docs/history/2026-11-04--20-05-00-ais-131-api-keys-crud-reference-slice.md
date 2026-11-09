# AIS-131 — api-keys CRUD reference slice (detail, PATCH edit, ConfirmDialog delete)

**Date:** 2026-11-04 20:05 (Europe/Budapest)
**Ticket:** AIS-131 (subtask of AIS-129)
**Plan:** [`docs/plans/2026-11-04--19-50-00-ais-131-api-keys-crud-reference-slice-plan.md`](../plans/2026-11-04--19-50-00-ais-131-api-keys-crud-reference-slice-plan.md)
**Milestone:** [`docs/milestones/2026-11-04--20-05-00-ais-131-api-keys-crud-reference-slice.milestone.md`](../milestones/2026-11-04--20-05-00-ais-131-api-keys-crud-reference-slice.milestone.md)

## What changed

The `api-keys` page stopped being “list + create” and became the complete CRUD reference slice:
detail read, inline `PATCH` editing and a `ConfirmDialog` delete — all on top of the existing generic
hooks, without a single new fetch, error shape or colour.

### Route and registry

| File                                                 | Change                                                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`app/app.const.ts`](../../apps/admin/src/app/app.const.ts:36) | Documents why the **detail** path template does *not* live here (`pages` may not import `app`)    |
| [`app/router/route-registry.tsx`](../../apps/admin/src/app/router/route-registry.tsx:56) | New entry `/api-keys/:identifier`, `navLabel: null` — the nav derives itself, no new nav code |
| [`app/router/route-registry.test.ts`](../../apps/admin/src/app/router/route-registry.test.ts:60) | The “every protected entry has a label” invariant contradicted its own interface doc; replaced by “an unlinked entry must be a parameter route”, plus a pin of the list path used by the detail page |

### Feature layer (server state)

[`features/api-keys/`](../../apps/admin/src/features/api-keys/use-api-keys.ts:40) gained three adapters
over the generic hooks, so the CRUD machinery that existed since AIS-114 finally has call sites:
`useApiKeyDetailQuery` (`useApiDetail`), `useUpdateApiKeyMutation` and `useDeleteApiKeyMutation`
(`useApiMutation`, invalidating `API_KEYS_QUERY_KEYS.all`). `API_KEY_EDIT_FIELD_PATHS` declares the three
fields a `PATCH` may touch.

### Entity layer (display)

[`entities/api-key/api-key.mapper.ts`](../../apps/admin/src/entities/api-key/api-key.mapper.ts:38) gained
`toExpiryBadge` (a **derived** `active` / `expired` / `none` / `unknown` verdict — the API stores only a
timestamp) and `toApiKeyDetailViewModel` (formatted timestamps, token still dropped).
[`lib/date.ts`](../../apps/admin/src/lib/date.ts:74) gained `toDateInputValue` and `formatDateTime`.

### Page layer

| File                                                             | Purpose                                                              |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`pages/api-keys/ApiKeyDetailPage.tsx`](../../apps/admin/src/pages/api-keys/ApiKeyDetailPage.tsx:44) | Composition: `useParams` → detail query → card + form; `404` branch; stale-write alert with reload; delete dialog; form remount keyed on `updatedAt` |
| [`ui/ApiKeyDetailCard.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyDetailCard.tsx:22) | `DescriptionList` + `StatusBadge` + delete **request** callback |
| [`ui/ApiKeyEditForm.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyEditForm.tsx:35) | `useAppForm` with the derived `apiKeyEditFormSchema`; the write is injected by the page |
| [`ui/ApiKeyDeleteDialog.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyDeleteDialog.tsx:23) | `ConfirmDialog`; a failure replaces the description instead of closing |
| [`ui/ApiKeysTable.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeysTable.tsx:21) | The name cell is now the link into the detail page |

Pure page rules live in [`pages/api-keys/api-keys.logic.ts`](../../apps/admin/src/pages/api-keys/api-keys.logic.ts:99):
`apiKeyEditFormSchema` (derived from the shared `updateApiKeySchema`), `toUpdateApiKeyInput`
(`''` → `null`, day → instant, `updatedAt` always sent), `toApiKeyEditFormValues`, `toApiKeyDetailRoute`.

### Error routing

[`lib/error-surface.logic.ts`](../../apps/admin/src/lib/error-surface.logic.ts:53) gained
`isNotFoundFailure` and `isStaleWriteFailure`. They live in the allowlisted decision module because a
component may not branch on `error.code` (`pnpm quality:field-errors`). Result: `404` → “not found” with
a way back, `409 STALE_WRITE` → page alert + reload, `422` → the blamed input via `toFieldErrors`.

### Tests and mocks

[`test/mocks/handlers/api-keys.handlers.ts`](../../apps/admin/src/test/mocks/handlers/api-keys.handlers.ts:209)
gained `apiKeysDetailServerError`, `apiKeysUpdateSuccess` (with a **newer** `updatedAt`),
`apiKeysUpdateStaleWrite`, `apiKeysUpdateSemanticInvalid`, `apiKeysUpdateNotFound`,
`apiKeysDeleteSuccess`, `apiKeysDeleteNotFound`; the happy-path update/delete joined the default set.

New suites: `ApiKeyDetailPage.test.tsx`, `ui/ApiKeyEditForm.test.tsx`, `ui/ApiKeyDetailCard.test.tsx`.
Extended: `ui/ApiKeysTable.test.tsx` (router wrapper + link), `api-keys.logic.test.ts`,
`api-key.mapper.test.ts`, `lib/date.test.ts`, `lib/error-surface.logic.test.ts`,
`features/api-keys/use-api-keys.test.tsx` (detail, update, delete).

## Deviations from the plan

| Plan                                                          | Built                                                                                                                 | Why                                                                                                                       |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| One `ApiKeyDetailCard.tsx` holding the dialog                 | Card (display + request callback) and a separate `ApiKeyDeleteDialog.tsx`                                             | The “close only on success” rule needs the mutation result, so the open flag belongs to the page; the card stays presentational |
| Route template in `app/app.const.ts`                          | Template in `pages/api-keys/api-keys.const.ts`                                                                        | `no-page-to-higher-layer`: the table links to it, so the literal has to be reachable from `pages`; the registry imports the page const and a test pins the list path |

## Verification

```text
pnpm quality && pnpm typecheck && pnpm -r build && pnpm -r lint && pnpm test
```

Manual smoke: `pnpm dev` → `/api-keys` → click a name → edit → save → reload → delete with confirmation.
