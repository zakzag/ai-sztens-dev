# AIS-172 — api-keys: edit as a route-mounted overlay

Plan: [`docs/plans/2026-11-08--16-15-00-ais-172-api-keys-edit-overlay-plan.md`](../plans/2026-11-08--16-15-00-ais-172-api-keys-edit-overlay-plan.md) ·
Milestone: [`docs/milestones/2026-11-08--17-15-00-ais-172-api-keys-edit-overlay.milestone.md`](../milestones/2026-11-08--17-15-00-ais-172-api-keys-edit-overlay.milestone.md)

Second step of AIS-170 (after AIS-171 `PageShell`, before AIS-173 delete): the
inline editor is gone, `/api-keys/:identifier/edit` is the third overlay child of
the list route.

## Changes

| #   | Area                                                                                                         | What happened                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `pages/api-keys/ui/ApiKeyEditDialog.tsx`                                                                     | **New** route element: `useParams` → `useApiKeyDetailQuery`, `useEntityDialog` for the close, four states (loading / 404 / page error / success). On success it renders `<ApiKeyEditDialogForm key={data.updatedAt} … onStaleWrite={detail.refetch} />` and nothing else — the key cannot live inside the component that calls `useAppForm`                               |
| 2   | `pages/api-keys/ui/ApiKeyEditDialogForm.tsx`                                                                 | **New** form window: `useAppForm` + `apiKeyEditFormSchema`, `<form id>` + the three moved controls + `formError` residue `Alert`, `EntityDialog` footer submit (`Módosítás` / `Mentés…`), `useNotifier()` success message, `onSuccess` closes. Its `submit` catches a stale write, calls `onStaleWrite()` and rethrows so `useAppForm` keeps owning the announce/map step |
| 3   | `pages/api-keys/ui/ApiKeyEditForm.tsx` + `.test.tsx`                                                         | **Deleted** (markup lifted into #2, scenarios lifted into #6)                                                                                                                                                                                                                                                                                                             |
| 4   | `pages/api-keys/ApiKeyDetailPage.tsx`                                                                        | Delete-only now: inline editor, `isSaved`, `isStale`, the two `Alert`s, `useUpdateApiKeyMutation` and the now-unused imports removed. The confirm dialog stays until AIS-173                                                                                                                                                                                              |
| 5   | `pages/api-keys/ui/ApiKeyViewDialog.tsx`                                                                     | Footer action is `Módosítás` → `toApiKeyEditRoute(identifier)` instead of the legacy `Teljes oldal (törlés)` link                                                                                                                                                                                                                                                         |
| 6   | `pages/api-keys/ui/ApiKeyEditDialog.test.tsx`                                                                | **New**, 9 route-level cases: prefill, PATCH with `updatedAt` + one toast + close navigation, client-side block, `422` → field + focus + no toast, `409 STALE_WRITE` → one capture toast, no field error, window open, second `GET`, remounted values, 404, 500 + retry, pending label, dismiss without a request                                                         |
| 7   | `pages/api-keys/api-keys.const.ts`                                                                           | `API_KEY_EDIT_ROUTE_PATH`, `API_KEY_EDIT_DIALOG_TITLE/FORM_ID/SUBMIT_LABEL/PENDING_LABEL`, `API_KEY_VIEW_EDIT_LINK_LABEL`; removed `API_KEY_EDIT_FORM_TITLE/_SUBMIT_LABEL/_PENDING_LABEL`, `API_KEY_VIEW_DELETE_LINK_LABEL` and the whole `API_KEY_DETAIL_STALE_WRITE_*` block (the toast now speaks)                                                                     |
| 8   | `pages/api-keys/api-keys.logic.ts`                                                                           | `toApiKeyEditRoute()` added; `toApiKeyDetailRoute()` deleted (the view overlay was its last consumer)                                                                                                                                                                                                                                                                     |
| 9   | `pages/api-keys/api-keys.interface.ts`                                                                       | `ApiKeyEditFormProps` removed, `ApiKeyEditDialogFormProps` added (`data`, `identifier`, `onClose`, `onStaleWrite`)                                                                                                                                                                                                                                                        |
| 10  | `app/router/route-registry.tsx`                                                                              | Third child of `/api-keys`: `navLabel: null`, crumb = the window title, `resolveBreadcrumbLabel` → `params.identifier`                                                                                                                                                                                                                                                    |
| 11  | `test/mocks/handlers/api-keys.handlers.ts`                                                                   | `apiKeysUpdatePending`, `API_KEY_AFTER_STALE_WRITE`, `createApiKeysDetailRefetchHandler()` (first read = fixture, later reads = the winner)                                                                                                                                                                                                                               |
| 12  | `ApiKeyViewDialog.test.tsx`, `ApiKeyDetailPage.test.tsx`, `api-keys.logic.test.ts`, `route-registry.test.ts` | Re-pointed at `/edit`, reduced to the delete-only page, route helper coverage, new registry invariant                                                                                                                                                                                                                                                                     |
| 13  | `docs/Specs/*`                                                                                               | `UI-Architecture.md` (§5 row + overlay table + the two edit-overlay decisions), `New-Admin-Page.md` (12b + reference routes), `Forms-and-Validation.md` (§5 single surface, §6 test table, §7 migration), `Admin-Data-Flow.md` (§3.7 flow + rules 2/3/5); all four header dates bumped                                                                                    |

## Decisions worth remembering

- **One success surface.** `AIS136-D1` (toast **and** page `Alert`) is retired: the
  overlay closes on success, so the toast is enough.
- **`409 STALE_WRITE` = one toast + explicit re-read.** `STALE_WRITE` has
  `fieldMessage: null`, so it is `page`-tier and `formError` stays `null`; the
  cache only invalidates after a _successful_ write, hence `onStaleWrite()` →
  `detail.refetch()` → new `updatedAt` → remount.
- **Two components, one reason.** `useAppForm` cannot be keyed from outside and
  the footer needs `formState.isSubmitting`, so the query and the form live
  apart; the child is keyed by `updatedAt`.
- **DoD grep stayed clean**: `rg "ApiKeyEditForm" apps/admin/src` → no hits.

## Verification

```
pnpm typecheck                                        # green
pnpm --filter @callback/admin test -- ApiKeyEditDialog ApiKeyViewDialog ApiKeyDetailPage route-registry api-keys.logic ApiKeysPage   # 95 passed
pnpm quality                                          # layers 130 modules, knip, tokens, themes, field-errors, docs — all green
```

## Follow-ups

- **AIS-173**: delete into the view overlay, `ApiKeyDetailPage` +
  `ApiKeyDeleteDialog` + `API_KEY_DETAIL_ROUTE_PATH` removed, the edit
  overlay's 404 branch re-pointed at the list.
- `apps/admin`'s `pnpm test` (full) and `pnpm lint` still need to run on the
  whole app for the final gate; the targeted suites were the ones touched here.
