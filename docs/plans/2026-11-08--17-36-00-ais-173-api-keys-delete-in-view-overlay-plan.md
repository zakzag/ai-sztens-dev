# AIS-173 — api-keys: delete moves into the view overlay, legacy detail page retired

**Ticket:** AIS-173 (subtask of AIS-170) · **Prerequisite:** AIS-172 (edit overlay) · **Blocks:** AIS-170/4 (docs)
**Branch key:** AIS-173 · **Commit:** `AIS-173: refactor(admin): move api-key delete into the view overlay`

## Goal

Move the confirmed soft delete from the legacy `/api-keys/:identifier` page into the read-only
overlay (`/api-keys/:identifier/view`), then delete the legacy page, its route, and the
`ApiKeyDeleteDialog` wrapper. Network and cache behaviour stay untouched
(`useDeleteApiKeyMutation`).

## Drift: ticket vs. current code (must be resolved before coding)

| Ticket says                                                    | Reality in the tree                                                                                                                          | Plan                                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| delete `toApiKeyDetailRoute()` from `api-keys.logic.ts`        | such a function does **not** exist; the table links through `toApiKeyViewRoute()`                                                             | nothing to delete in the logic module; only `api-keys.logic.test.ts` loses the `API_KEY_DETAIL_ROUTE_PATH` assertion |
| delete `API_KEY_VIEW_DELETE_LINK_LABEL`                        | the constant is `API_KEY_VIEW_EDIT_LINK_LABEL` (`Módosítás`) and it **stays** (AIS-172)                                                        | no change                                                                                 |
| delete `ApiKeyDetailPage` + `ApiKeyDeleteDialog` only          | [`ApiKeyDetailCard.tsx`](../../apps/admin/src/pages/api-keys/ui/ApiKeyDetailCard.tsx:1) + its test + `ApiKeyDetailCardProps` + `API_KEY_DELETE_LABEL` become unreferenced → knip fails | delete the card and its test too; keep `API_KEY_DELETE_LABEL` as the new footer button label |
| —                                                              | `API_KEY_DETAIL_BACK_ARIA_LABEL` is used only by the deleted page                                                                             | delete it; `API_KEY_DETAIL_BACK_LABEL` stays (view overlay 404 branch)                    |

## Decisions

- **D-A — no `/delete` route.** The confirmation window is not a navigation target: one
  `useState` flag is cheaper than a route + breadcrumb + registry entry + test. A documented,
  deliberate exception to "dialog open state = URL".
- **D-B — the wrapper dissolves.** A ~40-line single-use wrapper becomes a direct `ConfirmDialog`
  inside the view overlay.
- **D-C — the deleted page's tests move, they do not vanish.** 404 branch, page-error branch and the
  three delete-flow cases go to `ApiKeyViewDialog.test.tsx`; the stale-write case already lives in
  `ApiKeyEditDialog.test.tsx` (AIS-172).
- **D-D — `ApiKeyDetailFields` stays.** Shared by the view overlay and the future card view.
- **D-E — footer layout.** `footerExtras` renders as the left group of a `justify-between` row, so the
  delete button and the edit link go into one `<div className="flex items-center gap-2">`.

## Implementation steps

1. `apps/admin/src/pages/api-keys/ui/ApiKeyViewDialog.tsx`
   - add `useState` `isConfirmOpen`; `useDeleteApiKeyMutation(identifier, { onDeleted: closeDialog })`;
   - `footerExtras` → delete `<Button variant="danger">` (`API_KEY_DELETE_LABEL`) opening the
     confirmation + the existing `Módosítás` link;
   - render `ConfirmDialog` (`open`, `onOpenChange`, `API_KEY_DELETE_DIALOG_TITLE`,
     `description={deleteErrorMessage ?? API_KEY_DELETE_DIALOG_DESCRIPTION}`, confirm/cancel labels,
     `tone="danger"`, `isPending`, `onConfirm`) directly in the file;
   - update the file's JSDoc: the window is now the only destructive surface of the section.
2. Delete `apps/admin/src/pages/api-keys/ui/ApiKeyDeleteDialog.tsx`.
3. Delete `apps/admin/src/pages/api-keys/ApiKeyDetailPage.tsx` + `ApiKeyDetailPage.test.tsx`.
4. Delete `apps/admin/src/pages/api-keys/ui/ApiKeyDetailCard.tsx` + `ApiKeyDetailCard.test.tsx`;
   remove `ApiKeyDetailCardProps` from `api-keys.interface.ts`.
5. `apps/admin/src/pages/api-keys/api-keys.const.ts` — remove `API_KEY_DETAIL_ROUTE_PATH`,
   `API_KEY_DETAIL_TITLE`, `API_KEY_DETAIL_SUBTITLE`, `API_KEY_DETAIL_BACK_ARIA_LABEL`; fix the
   `API_KEY_DETAIL_ROUTE_PATH` / `API_KEY_VIEW_ROUTE_PATH` / list-path JSDoc that refers to the
   legacy page.
6. `apps/admin/src/app/router/route-registry.tsx` — drop the `API_KEY_DETAIL_ROUTE_PATH` entry and the
   `ApiKeyDetailPage` import; delete the `resolveBreadcrumbLabel` resolver branch that pointed at it.
7. Mocks: no new handler needed — `apiKeysDeleteSuccess` / `apiKeysDeleteNotFound` already exist in
   [`api-keys.handlers.ts`](../../apps/admin/src/test/mocks/handlers/api-keys.handlers.ts:307).

## Tests

- `ui/ApiKeyViewDialog.test.tsx` (extend): delete button opens the confirmation → confirming sends
  exactly one `DELETE`, invalidates and navigates to `/api-keys` with `replace`; failure keeps the
  dialog open, shows the mapped error as its description and does not navigate; cancel sends no
  request and closes; 404 → `EmptyState`; page error → `PageErrorState` + retry (already covered,
  keep); pending delete disables confirm/cancel (ported from `ApiKeyDetailCard.test.tsx`).
- `api-keys.logic.test.ts`: drop the `API_KEY_DETAIL_ROUTE_PATH` assertion only.
- `app/router/route-registry.test.ts`: the detail entry is gone; a `:identifier` path exists **only**
  as an overlay child (`/view`, `/edit`) with a resolver; an unknown `/api-keys/x` falls through to the
  catch-all; the "unlinked top-level entry needs a parameter" invariant is kept but re-commented (it
  is now satisfied vacuously).
- `app/router/route-tree.logic.test.ts`: no change expected — verify it does not reference the
  detail path.

## Documentation (same change)

- `docs/Specs/UI-Architecture.md`: delete the `ApiKeyDetailPage` row from §5 and the `ApiKeyDetailPage`
  mentions in §1/§4 PageShell consumers; add the `ConfirmDialog` local-state exception sentence and the
  delete row to the AIS-155 overlay table; refresh `**Utolsó frissítés:**`.
- `docs/Specs/New-Admin-Page.md`: step 12b now describes delete-as-confirmation inside the view overlay;
  the anti-pattern row gains the exception; refresh `**Utolsó frissítés:**`.
- `.roo/rules/react.coding-standards.md` §6.3: one sentence — the open state of a **non-navigable
  confirmation dialog** is local state, not URL state.
- `docs/history/<timestamp>-ais-173-api-keys-delete-in-view-overlay.md` (change summary) and
  `docs/milestones/<timestamp>-api-keys-legacy-detail-page-retirement.milestone.md` (multi-file
  retirement + route removal — milestone criteria met).

## Verification

- `rg "ApiKeyDetailPage|ApiKeyDeleteDialog|ApiKeyDetailCard|API_KEY_DETAIL_ROUTE_PATH" apps/admin/src` → no hits.
- `pnpm --filter @callback/admin test`, `pnpm typecheck`, `pnpm lint`, `pnpm quality` (knip/dead-code,
  `quality:docs`, palette/theme gates) all green.
- Manual: open a key from the list → `Törlés` → confirm → list refreshes without the row and the URL is
  `/api-keys`; reload a `/api-keys/x` URL → catch-all "not found" page (intended).

## Definition of done

- [ ] Delete works from the view overlay, with confirmation, list refreshed after success.
- [ ] No dead export: `ApiKeyDetailPage`, `ApiKeyDeleteDialog`, `ApiKeyDetailCard` and their tests are gone.
- [ ] `/api-keys/:identifier` no longer exists in the registry; the state-plan row is deleted.
- [ ] Tests, typecheck, lint and `pnpm quality` green; docs and `Utolsó frissítés` refreshed.
