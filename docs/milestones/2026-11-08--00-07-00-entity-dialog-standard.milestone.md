# Entity-overlay standard (`EntityDialog`) — AIS-155

**Date:** 2026-11-08 · **Ticket:** AIS-155 (AIS-156 … AIS-162) · **Scope:** `packages/ui`, `apps/admin`

## 1. Problem / feature

Every entity create/edit surface in the admin was being invented page by page. The `api-keys` page
rendered its create form **inline under the table**, had no standard way to show one record read-only,
and no reusable window primitive: `Dialog` had a fixed size, a `✕` text glyph and no "no submit"
(read-only) mode. There was also no route-based modal, so a dialog could not be linked, reloaded or
closed back to a list.

Goal: one reusable, **route-mounted** overlay window that becomes the standard for every entity, and an
`api-keys` page that shows **only the list** by default.

## 2. Evidence

- `packages/ui/src/components/dialog/OverlayShell.tsx` closed with `<span aria-hidden>✕</span>` and
  always rendered a footer; `dialogVariants` offered `sm|md|lg` only (all `w-full max-w-*`).
- The icon set had six icons and **no** `+` and **no** `X`.
- `RouteEntry` was flat and `AppRouter` rendered one `<Route>` per entry — no `<Outlet/>`, so a child
  route could not paint above a mounted list.
- `ApiKeysPage` ended with `<ApiKeyForm />`: the page mixed list and form, and nothing linked a
  read-only record view.

## 3. Design rationale

| Decision | Why |
| --- | --- |
| `EntityDialog` lives in `packages/ui`, the route wiring in `apps/admin` | The primitive must not import a router or know an entity; domain knowledge stays in the app |
| Nested route (`RouteEntry.children` + `<Outlet/>`), not a query parameter | Shareable, reload-safe URL, and the **list stays mounted** behind the dialog (no second fetch, no lost scroll) |
| A pure `flattenRouteEntries()` feeds the flat consumers | The breadcrumb matcher and the registry invariants already work on a flat table — they are fed, not rewritten |
| The dialog has **no `open` prop** | The route is the only owner of "is it open"; a second copy of that state is a defect |
| Optional submit with `type="submit" form={formId}` | The `<form>` and `useAppForm` stay the single submit path; the footer button only bridges body → footer |
| `submit: null` = read-only window | A view surface must not be able to write, and must not render a dead submit button |
| Close = `navigate(listPath, { replace: true })`, never `history.back()` | A deep link (`/api-keys/new`) has no list entry in the history, and a closed dialog must not re-open on "back" |
| `size="fit"` on the panel, body scrolls | "As big as the content", never taller than the viewport; header and footer stay visible |

Alternatives rejected: a controlled `Dialog` opened from page `useState` (not linkable, needs page
state), a query parameter (`?dialog=new` — pollutes the list query and the schema), and a full-screen
drawer (heavier than the request).

## 4. Implementation

**`packages/ui`**

- `icons.tsx` — `PlusIcon`, `CloseIcon` (Lucide geometry, ISC).
- `button.interface.ts` / `Button.tsx` — `icon` slot; the spinner replaces the icon while loading.
- `dialog.variants.ts` — `size: 'fit'` (`w-auto`, viewport max width/height).
- `OverlayShell.tsx` — `headerStart` / `headerEnd` slots, `CloseIcon` instead of `✕`.
- `entity-dialog/` — new `EntityDialog` (`EntityDialog.tsx`, `.const.ts`, `.interface.ts`).

**`apps/admin`**

- `app/router/route-entry.interface.ts` — `children?: readonly RouteEntry[]` (absolute child paths).
- `app/router/route-tree.logic.ts` — `flattenRouteEntries()`; `ALL_ROUTE_ENTRIES` and
  `AppBreadcrumb` use it.
- `app/router/AppRouter.tsx` — recursive `toRouteElements()`.
- `app/router/route-registry.tsx` — `/api-keys` becomes a layout route with `/api-keys/new` and
  `/api-keys/:identifier/view` children.
- `features/entity-dialog/` — `useEntityDialog(listPath)`, the one close rule.
- `pages/api-keys/ApiKeysPage.tsx` — list-first, header action "Új API kulcs", `<Outlet/>`.
- `pages/api-keys/ui/` — `ApiKeyCreateDialog`, `ApiKeyFormFields`, `ApiKeyViewDialog`,
  `ApiKeyDetailFields` (extracted from `ApiKeyDetailCard`); `ApiKeyForm.tsx` removed.
- `.dependency-cruiser.rules.cjs` — `entity-dialog` added to `SHARED_FEATURES`.

## 5. Outcome and how to verify

```bash
pnpm --filter @callback/ui test      # 496 tests
pnpm --filter @callback/admin test   # 516 tests
pnpm typecheck && pnpm lint && pnpm quality
```

Manual: `/api-keys` shows only the list plus "＋ Új API kulcs"; `/api-keys/new` re-opens after a reload;
saving closes to `/api-keys` and the list refreshes; `/api-keys/<id>/view` is read-only, `Esc`/`X`/
"Vissza a listához" all land on the list; "Teljes oldal (törlés)" opens the legacy detail page.

## 6. Follow-ups

- Retire the legacy `/api-keys/:identifier` page and move delete into the view overlay.
- Replace the remaining `✕` glyphs (`Toast`, `Banner`, `LogDrawer`) with `CloseIcon`.
- Migrate the next entity (calls) to the same overlay standard.
