# AIS-172 — editing an API key became a route-mounted overlay

## 1. Problem / feature

The `api-keys` resource had three different CRUD entry points: creating opened a
route-mounted overlay (`/api-keys/new`), reading a row opened a second overlay
(`/api-keys/:identifier/view`), but **editing** was an inline `Card` under the
legacy detail page (`/api-keys/:identifier`), and deleting lived on the same
page behind a `useState`-driven `ConfirmDialog`. One entity, three interaction
models — while `.roo/rules/react.coding-standards.md` §0.3 and
`New-Admin-Page.md` step **12b** both say the create/edit surface is a URL.

## 2. Evidence

| Symptom                                 | Where                                                      |
| --------------------------------------- | ---------------------------------------------------------- |
| Inline editor under a table             | `pages/api-keys/ui/ApiKeyEditForm.tsx` (deleted)           |
| “Is the dialog open” kept in `useState` | `ApiKeyDetailPage` (`isConfirmOpen`, `isSaved`, `isStale`) |
| Same save announced twice               | success `Alert` (AIS136-D1) **and** the notify-port toast  |
| Dead route helper once the editor moves | `toApiKeyDetailRoute()`, consumer: the view overlay only   |

## 3. Design rationale

- **Three children of one parent route.** `/edit` is a sibling of `/new` and
  `/view` in the registry, so the list stays mounted behind the window and the
  editor is linkable/reloadable.
- **The route element cannot own the form.** react-hook-form seeds
  `defaultValues` on mount only, and the footer submit needs
  `formState.isSubmitting`. So the query lives in `ApiKeyEditDialog` and the form
  in a second component, `ApiKeyEditDialogForm`, keyed by `data.updatedAt`.
- **`409 STALE_WRITE` has one surface.** `STALE_WRITE` carries
  `fieldMessage: null`, so `toErrorSurface` classifies it `page` and
  `toFormErrorPlan` deliberately leaves `formError` `null`: the capture toast
  speaks. The window then re-reads the row **explicitly**, because invalidation
  only runs after a successful write; the new `updatedAt` remounts the form.
- **One success surface.** The page-level `Alert` is gone (AIS136-D1 retired);
  the notify port's toast is the only announcement, exactly like create.
- **Names chosen for the DoD grep.** `ApiKeyEditDialog` /
  `ApiKeyEditDialogForm` so `rg "ApiKeyEditForm"` stays empty.

## 4. Implementation

| File                                                | Change                                                                                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/api-keys/ui/ApiKeyEditDialog.tsx`            | **new** — route element: identifier from `useParams`, detail read, loading / 404 / page-error windows, success → keyed form window                 |
| `pages/api-keys/ui/ApiKeyEditDialogForm.tsx`        | **new** — `useAppForm` + `EntityDialog` footer submit, three moved controls, `formError` residue `Alert`, stale write → `onStaleWrite()` + rethrow |
| `pages/api-keys/ui/ApiKeyEditForm.tsx`, `.test.tsx` | **deleted**                                                                                                                                        |
| `pages/api-keys/ApiKeyDetailPage.tsx`               | inline editor, `isSaved`/`isStale`, both `Alert`s and `useUpdateApiKeyMutation` removed; delete-only until AIS-173                                 |
| `pages/api-keys/ui/ApiKeyViewDialog.tsx`            | footer action → `Módosítás` link to `/edit`                                                                                                        |
| `pages/api-keys/api-keys.const.ts`                  | `API_KEY_EDIT_ROUTE_PATH`, `API_KEY_EDIT_DIALOG_*`; dropped dead `STALE_WRITE`/title copy                                                          |
| `pages/api-keys/api-keys.logic.ts`                  | `toApiKeyEditRoute` added, `toApiKeyDetailRoute` deleted                                                                                           |
| `app/router/route-registry.tsx`                     | third child entry with title crumb + identifier resolver                                                                                           |
| `test/mocks/handlers/api-keys.handlers.ts`          | `apiKeysUpdatePending`, `createApiKeysDetailRefetchHandler`, `API_KEY_AFTER_STALE_WRITE`                                                           |
| four `docs/Specs/*.md`                              | header dates + state plan, 12b, form/test tables, data-flow §3.7                                                                                   |

## 5. Outcome and how to verify

```bash
rg "ApiKeyEditForm" apps/admin/src      # no hits
pnpm --filter @callback/admin test     # 95+ targeted tests, incl. the 9 new ones
pnpm typecheck && pnpm quality         # layers, knip, tokens, themes, field-errors, docs
```

Manual: list → row → `Módosítás` → change the name → save (one toast, back to
the list); reload `/api-keys/<id>/edit` (window stays open, values prefilled);
force a stale write (window stays open, one error toast, the winner's values
appear); clear the name (field error, no request); `Esc` (list, one history
entry).

## 6. Follow-ups

- **AIS-173** moves the delete into the read-only overlay and deletes
  `ApiKeyDetailPage` + `ApiKeyDeleteDialog` + `API_KEY_DETAIL_ROUTE_PATH`.
- The edit overlay's `404` branch still shows the legacy back label; it will be
  re-pointed at the list when the detail route disappears.
