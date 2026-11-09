# AIS-136 — app-shell notification polish (drawer handle, toast matrix, render crashes)

**Date:** 2026-11-05 · **Ticket:** AIS-136 · **Plan:** [`docs/plans/2026-11-05--15-15-00-ais-136-admin-notification-polish-plan.md`](../plans/2026-11-05--15-15-00-ais-136-admin-notification-polish-plan.md)

## What changed

| # | Area | Change |
| - | ---- | ------ |
| 1 | `packages/ui` | The log drawer has **one always-mounted arrow handle** that opens *and* closes the panel. `toLogDrawerTabLabel` became `toLogDrawerHandleLabel(unseenCount, isOpen)`; new consts `LOG_DRAWER_HANDLE_COLLAPSED_GLYPH` (`‹`) / `LOG_DRAWER_HANDLE_OPEN_GLYPH` (`›`) / `LOG_DRAWER_HANDLE_CAPTION` / `LOG_DRAWER_HEADER_CLOSE_LABEL`; `logDrawerTabVariants` gained an `isOpen` variant; the open panel reserves `LOG_DRAWER_HANDLE_GUTTER` on the right. |
| 2 | `apps/admin` | `toFailureToast(surface)` makes the toast matrix **total**: `field` → log only, `banner` and `page` → log **and** toast (offline / `401` / `503` now toast next to `AppErrorBanner`). |
| 3 | `apps/admin` | `AppErrorBoundary` takes an injected `onError` port (`AppRenderErrorReport`) and reports every caught crash exactly once, guarded so a throwing port cannot break the fallback. New emitter `app/notifications/runtime-error.ts` (`runtime.error` defaults + `RUNTIME_ERROR_MESSAGE` + `toRuntimeDetail`); `App.tsx` builds it once from `notificationStore` with `import.meta.env.DEV`. |
| 4 | `apps/admin` | `ApiKeyEditForm` got the `notify` port + `API_KEY_EDIT_FORM_SUCCESS_MESSAGE`, so a successful `PATCH` produces one toast and one log entry (source `manual`, no `meta.successMessage`). |
| 5 | docs | `UI-Architecture.md` §4 + §4.1.3, `Forms-and-Validation.md` §3.1/§5/§6/§7, `API-Convention.md` §10, `New-Admin-Page.md` §2/§3 — all header dates refreshed. |

## Deviations from the ticket (all deliberate, all recorded)

1. **`AIS136-D1` — two success surfaces on the detail page.** The ticket says “exactly one success surface”; the owner decided on 2026-11-05 to **keep** the existing `isSaved` success `Alert` **and** add the toast. The `Alert` marks the saved state, the toast the moment; both read the same constant. `ApiKeyForm` stays single-surface.
2. **`AIS136-D2` — G4 wording.** The ticket says the edit form gave “no feedback at all”; it already rendered the success `Alert`. What was missing was the toast + log entry.
3. **`AIS136-D3` — the handle never moves.** Instead of shifting the handle next to the open panel (viewport-dependent, could go off-screen), the handle stays at `right-0` and the panel reserves a right gutter. No position jump, no reflow.
4. **`409 STALE_WRITE` is a `page`-tier failure.** The ticket's expected test “no toast for a stale write” cannot hold under `D1`: `STALE_WRITE` has no `fieldMessage` in the catalogue, so the classifier files it under `page` and it **does** toast (the page keeps its reload `Alert` as well). The “inline only” case the ticket meant is a `422` with `issues[]`, and that is what the new form test asserts.
5. **The header `✕` got its own accessible name** (`LOG_DRAWER_HEADER_CLOSE_LABEL` = “Naplópanel bezárása”). The handle's open-state name is `LOG_DRAWER_CLOSE_LABEL` per the ticket; two buttons with an identical accessible name would be indistinguishable to a screen reader.

## Verification (executed)

```text
pnpm typecheck                                   → green (all packages)
pnpm lint                                        → green
pnpm quality                                     → layers 100 modules / 161 deps, dead-code, tokens 0,
                                                   field-errors 0, docs 0 violations
pnpm --filter @callback/ui test                  → 41 files, 344 tests passed
pnpm --filter @callback/notifications test       →  9 files, 201 tests passed
pnpm --filter @callback/admin test               → 38 files, 409 tests passed
```

New/updated tests: `packages/ui/test/log-drawer.test.tsx` (24 cases incl. the four label-helper units),
`apps/admin/src/app/notifications/notification-events.logic.test.ts` (+`toFailureToast`, banner/offline/
`401`/`503`), `notification-capture.test.ts` (banner now toasts), `notification-capture.integration.test.tsx`
(banner → entry **and** toast; field → entry, no toast), new `runtime-error.test.ts`,
`AppErrorBoundary.test.tsx` (port once, no port, throwing port, real store),
`AdminLayout.test.tsx` (handle opens and closes), `ApiKeyEditForm.test.tsx` (one toast + one entry on save,
no toast on a blamed field), `ApiKeyDetailPage.test.tsx` (two success surfaces on purpose).

## Manual browser checklist (not automatable — no admin e2e harness)

To be executed against `pnpm dev` before closing the ticket:

1. `/api-keys` — the `‹` handle is visible at the right edge; clicking it opens the panel and it becomes `›`; clicking again closes it.
2. `/api-keys/:identifier` — the same handle behaves identically; the header `✕` and `Escape` still close the panel.
3. The panel itself: no overlay, page still scrollable, nothing shifts when toggling.
4. Trigger a `401` (expired session) → the banner **and** one toast **and** one log entry.
5. Force a render crash (temporary `throw` in a page component) → `PageErrorState` + one toast + one `runtime` log entry.
6. Trigger a `409` field error on a form → inline message only, no toast.
7. F5 after a few entries → the log is restored (`sessionStorage`, cap 200) and the drawer opens with the rows.
8. Keyboard only: `Tab` to the handle, visible focus ring, `Enter`/`Space` toggles.
