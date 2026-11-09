# AIS-116 — Data-display primitives and the completed api-keys list

**Date:** 2026-11-03 22:45 (Europe/Budapest)
**Ticket:** AIS-116 (sub-task of AIS-104)
**Plan:** [`2026-11-03--22-21-00-ais-116-data-display-primitives-plan.md`](../plans/2026-11-03--22-21-00-ais-116-data-display-primitives-plan.md:1)

## 1. Problem / feature

`packages/ui` had no data-display layer: every list page had to hand-write its table, its loading and
empty states, and a pager. `pages/api-keys` did exactly that — the table was hand-rolled, loading and
empty were two `<p>` elements, and `meta.pagination` was ignored entirely (the pager controls were
parked behind the comment “arrives with AIS-116”). The data pipeline was already finished
(`useListParams` + `useApiList`), so only the receiving UI was missing.

Goal: seven reusable primitives, plus the api-keys page rebuilt on them with a working pager and
server-side sorting, with page/limit/sort kept in the URL.

## 2. Measured data / evidence

- Before: `apps/admin` 28 test files / 239 tests; no page-level test existed for `/api-keys`.
- After: `packages/ui` 18 files / 152 tests (9 new files), `apps/admin` 29 files / 264 tests
  (new `ApiKeysPage.test.tsx`, rewritten `ApiKeysTable.test.tsx`).
- `pnpm quality` → layers OK (80 modules), knip clean, `0` palette violations, `0` field-error
  violations.
- Defect found while wiring the sort header: after `setParams({ sort: 'name', order: 'asc' })` the
  URL contained **neither** field (assertion received `null`). Root cause in §3.

## 3. Root cause or design rationale

**`@tanstack/react-table` rejected (decision Út A).** Sorting and paging are server-side (`sort`,
`order`, `page` are query fields) and the API caps a page at 100 rows. A client-side sorting engine
plus virtualisation would be dead code and would introduce a second table implementation to migrate.
`DataTable` therefore *composes* the six existing `Table*` primitives; `packages/ui/package.json` is
unchanged.

**Structural `PaginationMeta` (D1).** The four pager fields are declared in `packages/ui`, so the
API's `meta.pagination` is assignable without a mapper — four fields are not worth coupling the UI
package to `@callback/shared`.

**`DataTable` never sorts locally (D2).** It reports the requested sort (`onSortChange`); the order
lives on the server and the request lives in the URL. `aria-sort` still marks the sorted column, even
in a read-only table, because it describes the data order, not interactivity.

**`Skeleton` is static (D3).** `theme.css` has no motion token for a pulse; inventing a duration in
a component would break the token rule, so the placeholder is sunken surface + inset shadow.

**Batch setter (D4) — and the defect it exposed.** A sort header click changes two query fields at
once. `setParam` rebuilds the URL from the *current* `params`, so two consecutive calls make the
second overwrite the first *and* create two history entries. `setParams(patch)` merges the patch and
writes once. While proving this, the page test exposed a pre-existing AIS-119 bug: `useListParams`
serialised the URL against the **candidate's own values** instead of the schema defaults, so
`sort`/`order`/`limit` were always considered “unchanged” and never written. Fixed by comparing
against the memoised `parseListParamsDefaults(schema)`.

## 4. Solution / implementation

| File | Change |
| --- | --- |
| `packages/ui/src/components/skeleton/**` | `Skeleton` (`shape` line/field/row, `lines`), static, `aria-hidden` |
| `packages/ui/src/components/spinner/**` | `Spinner` (`size`, `label`), `role="status"` + `sr-only` label |
| `packages/ui/src/components/empty-state/**` | `EmptyState` (`title`, `description`, optional CTA) |
| `packages/ui/src/components/description-list/**` | `DescriptionList` (real `<dl>`, loading/empty slots, 1–2 columns) |
| `packages/ui/src/components/status-badge/**` | `StatusBadge` (`Badge` + `data-status`, no new colour) |
| `packages/ui/src/components/pagination/**` | `Pagination` + pure rules `toVisiblePages`, `toRangeLabel`, `clampLimit` |
| `packages/ui/src/components/data-table/**` | `DataTable` (+ `DataTableHead`, `DataTableLoadingRows`, `toAriaSort`, `toNextSort`) |
| `packages/ui/src/index.ts` | explicit exports for the seven primitives and the pager labels |
| `apps/admin/src/features/api/use-list-params.logic.ts` | `applyListParamsPatch`, `applyPatchDefaults` |
| `apps/admin/src/features/api/use-list-params.ts` | `setParams(patch)`; single `writeParams`; schema-default comparison fix |
| `apps/admin/src/pages/api-keys/api-keys.logic.ts` | `isApiKeySortable`, `toTableSort`, `toSortParams` |
| `apps/admin/src/pages/api-keys/api-keys.const.ts` | `API_KEYS_LIMIT_OPTIONS` (20 / 50 / 100) |
| `apps/admin/src/pages/api-keys/{ApiKeysPage.tsx,ui/ApiKeysTable.tsx,api-keys.interface.ts}` | pager + sortable `DataTable` + slot-based pager |
| `docs/Specs/UI-Architecture.md` §4/§5/§7, `docs/Specs/Admin-Data-Flow.md` §3.6 | primitives, URL state plan, no-new-dependency note, list recipe |

## 5. Outcome and how to verify

`/api-keys` renders loading (skeleton rows, header kept), empty (`EmptyState`), success
(`DataTable` + `Pagination`) and failure (`PageErrorState`). Page, page size and sort live in the
URL, so `?page=2&sort=name&order=asc` is a working deep link; a header click writes `sort`+`order`
in **one** URL write and resets the page to 1.

```powershell
pnpm --filter @callback/ui test        # 18 files / 152 tests
pnpm --filter @callback/ui build
pnpm --filter @callback/admin test     # 29 files / 264 tests
pnpm --filter @callback/admin build
pnpm quality                           # layers + knip + palette + field-errors
```

Manual check: open `/api-keys`, click a header twice (URL toggles `order`, page returns to 1), click
“next” (URL gains `page=2` and the request carries it), set the page size to 50 (`limit=50` in the
URL), and reload — the same view comes back.

## 6. Follow-ups

- Filter (`q`) UI is not part of this ticket; the grid and the URL already support it.
- `setParams` writes once by construction; the tests prove it through the resulting URL state
  (both fields in one state, no `page`), not by counting `setSearchParams` calls — a counter would
  require mocking the router module.
- Edit/delete row actions have a slot (`rowActions`) but no UI yet (AIS-117 territory).
- If a pulsing skeleton is wanted, extend `theme.css` with a motion token first (D3).
