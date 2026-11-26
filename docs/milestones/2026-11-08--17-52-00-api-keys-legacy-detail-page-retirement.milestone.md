# api-keys: delete moved into the view overlay, legacy detail page retired (AIS-173)

**Date:** 2026-11-08 · **Ticket:** AIS-173 · **Plan:**
[`docs/plans/2026-11-08--17-36-00-ais-173-api-keys-delete-in-view-overlay-plan.md`](../plans/2026-11-08--17-36-00-ais-173-api-keys-delete-in-view-overlay-plan.md)
· **Parent:** AIS-170 (uniform page surface)

## Problem

AIS-172 moved the *edit* surface of an API key into a route-mounted overlay
(`/api-keys/:identifier/edit`) and left the legacy detail page (`/api-keys/:identifier`) with exactly one
capability: the confirmed soft delete. The page therefore could not be removed — deleting a key had no
other address — and the section kept a third, half-empty surface next to the list and the overlays.

## Design rationale

- **The delete belongs where the key is visible.** The read-only overlay already renders the key, so the
  destructive action becomes a footer button there instead of a separate page whose only reason to exist
  was the delete.
- **A confirmation is not a route.** Create, view and edit are URL state because a reload or a copied
  link must re-open the same window. A `ConfirmDialog` has no such address: nothing links to it, nothing
  reloads into it. A `/delete` route would have cost a registry entry, a breadcrumb rule and a test for
  a window the user passes through in one click. The open flag is therefore a `useState` inside the view
  overlay — recorded as an explicit, documented exception to "a dialog's open state lives in the URL"
  (`.roo/rules/react.coding-standards.md` §6.3, `UI-Architecture.md` §5).
- **The wrapper dissolves.** `ApiKeyDeleteDialog` was a 42-line, single-use wrapper around
  `ConfirmDialog`; its copy and its one rule ("a failure is rendered inside the dialog") now live inline
  in the view overlay.
- **The tests move, they do not vanish.** The retired page's 404 branch, page-error branch and three
  delete cases were ported into `ApiKeyViewDialog.test.tsx`.
- **Deleting the page made two more files dead.** `ApiKeyDetailCard` and its test became unreferenced
  the moment the page disappeared, so they were removed too; `ApiKeyDetailFields` stays, because it is
  the shared field list of the overlay and a future card view.

## Implementation

| File | Change |
| ---- | ------ |
| `pages/api-keys/ui/ApiKeyViewDialog.tsx` | `useState` confirm flag, `useDeleteApiKeyMutation(identifier, { onDeleted: closeDialog })`, footer group (`Kulcs törlése` danger button + `Módosítás` link), inline `ConfirmDialog` with the mapped failure as its description. Footer actions render only when a row is loaded. |
| `pages/api-keys/ui/ApiKeyDeleteDialog.tsx` | deleted |
| `pages/api-keys/ApiKeyDetailPage.tsx` + `.test.tsx` | deleted |
| `pages/api-keys/ui/ApiKeyDetailCard.tsx` + `.test.tsx` | deleted (knip would have failed) |
| `pages/api-keys/api-keys.const.ts` | `API_KEY_DETAIL_ROUTE_PATH`, `API_KEY_DETAIL_TITLE`, `API_KEY_DETAIL_SUBTITLE`, `API_KEY_DETAIL_BACK_ARIA_LABEL` removed; surviving constants re-documented for the overlay |
| `pages/api-keys/api-keys.interface.ts` | `ApiKeyDetailCardProps`, `ApiKeyDeleteDialogProps` removed |
| `app/router/route-registry.tsx` | detail entry and import removed |
| `app/router/route-registry.test.ts` | detail invariant replaced: `:identifier` exists only on the `view` / `edit` overlay children |
| `pages/api-keys/ui/ApiKeyViewDialog.test.tsx` | new `delete (AIS-173)` block (open without a request, success + `replace`, cancel, failure stays open, pending disables both buttons) + 404/page-error now assert no delete affordance |
| `test/mocks/handlers/api-keys.handlers.ts` | `apiKeysDeletePending` handler added |

No network or cache change: `useDeleteApiKeyMutation` still invalidates `API_KEYS_QUERY_KEYS.all` and
calls `onDeleted` after a successful write, which is now `closeDialog` (one `replace` navigation).

## Outcome and verification

- Deleting a key happens from `/api-keys/:identifier/view`: confirm → one `DELETE` → list invalidated →
  `replace` navigation to `/api-keys`.
- `/api-keys/x` now falls to the catch-all "not found" page (intended); `/api-keys/x/view` and
  `/api-keys/x/edit` still resolve.
- Verified with `pnpm --filter @callback/admin test` (46 files, 539 tests), `pnpm typecheck`,
  `pnpm lint` and `pnpm quality` (layers, knip/dead-code, palette, themes, field-errors, docs) — all
  green.

## Follow-ups

- `docs/Specs/UI-Architecture.md` had a second `**Utolsó frissítés:**` changelog line (the AIS-172
  entry); AIS-173 is recorded as its own `**AIS-173 (2026-11-08):**` paragraph plus the refreshed header.
- A row/card view of `api-keys` (AIS-170) should reuse `ApiKeyDetailFields` instead of reintroducing a
  field list.
- If a second destructive confirmation appears, consider promoting the local-flag pattern into a shared
  `useConfirmAction` hook rather than repeating the handler shape.
