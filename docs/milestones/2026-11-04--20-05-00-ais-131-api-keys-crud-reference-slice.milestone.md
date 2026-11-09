# AIS-131 — the api-keys CRUD reference slice

**Date:** 2026-11-04 · **Ticket:** AIS-131 (subtask of AIS-129) · **Plan:**
[`docs/plans/2026-11-04--19-50-00-ais-131-api-keys-crud-reference-slice-plan.md`](../plans/2026-11-04--19-50-00-ais-131-api-keys-crud-reference-slice-plan.md)

## 1. Problem / feature

The admin app had exactly one resource (`api-keys`) and it demonstrated only **list** and **create**.
Meanwhile the whole write machinery was already built and unused: `useApiDetail`, `useApiMutation`,
`ConfirmDialog`, `DescriptionList`, `StatusBadge`, the server-side `PATCH` + `DELETE` with
`STALE_WRITE`, and the `API_KEYS_QUERY_KEYS.detail` key. The next product domain (companies,
AIS-19…22) is the first real consumer, and its detail/edit/delete pages would have been invented
from scratch by a second developer — the exact duplication the standardisation work exists to prevent.

## 2. Measured starting point

| Artefact                        | Location                                | Consumers before AIS-131 |
| ------------------------------- | --------------------------------------- | ------------------------ |
| `useApiDetail` / `useApiMutation` | `apps/admin/src/features/api/`        | 0                        |
| `ConfirmDialog`                  | `packages/ui/src/components/`          | 0                        |
| `DescriptionList`                | `packages/ui/src/components/`          | 0                        |
| `PATCH` / `DELETE` routes        | `apps/api/src/api-keys/` (AIS-108)     | 0 (no admin caller)      |
| `API_KEYS_QUERY_KEYS.detail`     | `features/api-keys/api-keys.const.ts`  | 0                        |

## 3. Root cause / design rationale

Nothing was missing on the wire; what was missing was **a page that exercises the wiring**, plus three
decisions nobody had written down:

1. **Where does a detail page get its key?** Answer: from the URL (`/api-keys/:identifier`, parameter
   named like the API route), so a detail link is shareable and the list can link to it.
2. **What does a lost update look like?** `409 STALE_WRITE` blames `updatedAt`, a hidden concurrency
   token. Treating it as a field error would put a message under an input that does not exist, so the
   page shows a reload offer instead — decided by `isStaleWriteFailure()` in the allowlisted
   `lib/error-surface.logic.ts`, never by `error.code ===` in a component (the `quality:field-errors`
   gate enforces this).
3. **What happens to the form after a save?** `useAppForm` closes a submit with
   `reset(defaultValues)`. With static defaults that reset restores the **pre-edit** values, so the
   page remounts the form with `key={updatedAt}` — which also makes “a new version exists” explicit.

Alternatives considered: a drawer-hosted edit (owner decision: inline; the drawer stays unused until a
page genuinely needs a side panel) and a modal-only delete without a detail page (rejected: the ticket
needs a detail surface for the token-less field list).

## 4. Solution / implementation

| File                                                    | Change                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pages/api-keys/ApiKeyDetailPage.tsx`                   | new page: detail query, `404` branch, stale-write alert + reload, delete dialog, form remount |
| `pages/api-keys/ui/ApiKeyDetailCard.tsx`                | `DescriptionList` + `StatusBadge` + delete **request** callback (no mutation)             |
| `pages/api-keys/ui/ApiKeyEditForm.tsx`                  | `useAppForm` + `apiKeyEditFormSchema`; the write is injected by the page                  |
| `pages/api-keys/ui/ApiKeyDeleteDialog.tsx`              | `ConfirmDialog`; a failure replaces the description instead of closing                    |
| `pages/api-keys/ui/ApiKeysTable.tsx`                    | the name cell links to `toApiKeyDetailRoute(identifier)`                                  |
| `pages/api-keys/api-keys.logic.ts`                      | `apiKeyEditFormSchema`, `toUpdateApiKeyInput`, `toApiKeyEditFormValues`, `toApiKeyDetailRoute` |
| `pages/api-keys/api-keys.const.ts`                      | route template + all new Hungarian copy                                                   |
| `features/api-keys/use-api-keys.ts`                     | `useApiKeyDetailQuery`, `useUpdateApiKeyMutation`, `useDeleteApiKeyMutation`              |
| `entities/api-key/api-key.mapper.ts`                    | `toExpiryBadge` (derived verdict), `toApiKeyDetailViewModel`                              |
| `lib/date.ts`                                           | `toDateInputValue` (ISO → date input), `formatDateTime`                                    |
| `lib/error-surface.logic.ts`                            | `isNotFoundFailure`, `isStaleWriteFailure`                                                |
| `app/router/route-registry.tsx`                         | the detail route entry (`navLabel: null`)                                                 |
| `test/mocks/handlers/api-keys.handlers.ts`              | detail `500`, `PATCH` (success / stale / semantic / 404), `DELETE` (success / 404)         |

The `PATCH` body never carries `identifier` or `apiKey`: the contract is `.strict()` and token rotation
is AIS-75, not a side effect of editing a description.

## 5. Outcome and how to verify

- `/api-keys` → click a name → `/api-keys/<identifier>`: fields in a `DescriptionList`, expiry as a
  `StatusBadge`, an inline edit form, a delete button that opens a confirmation dialog.
- Failure surfaces: `404` → “not found” + way back; `500` → `PageErrorState` with retry;
  `409 STALE_WRITE` → page alert with “Adatok újratöltése” and **no** field error; `422` → the blamed
  input and it takes focus.
- Delete: no request before confirmation; the dialog stays open while pending and on failure.

```text
pnpm quality && pnpm typecheck && pnpm -r build && pnpm -r lint && pnpm test
pnpm --filter @callback/admin test -- ApiKeyDetailPage ApiKeyEditForm ApiKeyDetailCard
```

Manual check: `pnpm dev`, then edit a key in two tabs — the second save must produce the reload alert.

## 6. Follow-ups

- Success feedback is an inline `Alert`; AIS-85 swaps it for the `notify` port once AIS-79…85 lands.
- `apps/api` `/api/api-keys*` is still unauthenticated (AIS-71/73) and returns the token value
  (AIS-75 changes the read schema).
- The `Drawer` primitive remains unproven in a page — accepted, not an omission.
