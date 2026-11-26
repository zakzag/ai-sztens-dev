# AIS-20 — customer detail page (shell + Áttekintés és Cégadatok tabs)

**Date:** 2026-11-25
**Ticket:** AIS-20 (`Admin - impl: admin oldal: cég adatlap (megjelenítés)`), parent story AIS-15
**Plan:** [`2026-11-25--12-11-00-ais-20-customer-detail-page-plan.md`](../plans/2026-11-25--12-11-00-ais-20-customer-detail-page-plan.md:1)

## What was built

`/customers/:id` — the read-only customer detail page: page header (display name + `customerNumber` +
status badge), a six-tab frame whose active tab is the **URL** (`?tab=`), and the first two tab bodies.
The four remaining tabs (`contacts`, `users`, `activity`, `audit`) already have their place in the frame
and render a placeholder until AIS-179 / AIS-181 land.

Nothing below the page changed: every prerequisite was already merged (AIS-17 screen contract, AIS-19
page folder and entity mapper, AIS-178 API + api-client `findById`, AIS-110/114 generic hooks,
AIS-120 MSW harness). `packages/shared`, `packages/api-client`, `apps/api` and `packages/ui` are
untouched — no contract change, no migration, no new dependency, no new primitive.

## Decisions taken before implementation

| # | Decision |
| --- | --- |
| Q1 | **No edit action in AIS-20.** The header renders name + `customerNumber` + `StatusBadge` only; the *Szerkesztés* link and the status/archive menu stay in AIS-21 (wave plan `D7`). The target route `/customers/:id/edit` does not exist yet, so a link now would fall into the `*` catch-all. |
| Q2 | **Flat page folder.** The detail files live in `apps/admin/src/pages/customers/` (screen contract §1, AIS-19 reality), not in a `pages/customers/customer/` subfolder. This supersedes the wave plan's `customer/…` paths for AIS-21 / AIS-179 / AIS-181 too. |
| D3 | The five rendered surfaces are chosen by the **pure** `toCustomerDetailState`, not by an `if` in the component: `loading` / `not-found` / `error` / `unavailable` / `success`. `unavailable` is the banner tier (offline, `401`, `503`), which the layout's `AppErrorBanner` already explains, so the page must not repeat that sentence (AIS-96). |
| D6 | Tab bodies come from a **total** `Record<CustomerTab, ComponentType<CustomerTabPanelProps>>`, so the four later tabs are added by editing one file and never `CustomerDetailPage.tsx`. |

## Changed and created files

| File | Change |
| --- | --- |
| `apps/admin/src/features/customers/use-customer-detail.ts` | **New.** `useApiDetail` adapter over `customersService.findById`, key `CUSTOMERS_QUERY_KEYS.detail(id)`, `enabled` only while the URL carries an id. |
| `apps/admin/src/entities/customer/customer.interface.ts` | `CustomerDetailGroup`, `CustomerDetailViewModel` (status stays a machine value — a badge is a React node, the mapper is pure). |
| `apps/admin/src/entities/customer/customer.const.ts` | `CUSTOMER_DETAIL_GROUP_TITLES`, `CUSTOMER_DETAIL_FIELD_LABELS`, `CUSTOMER_DETAIL_OVERVIEW_LABELS`, `CUSTOMER_HEADCOUNT_RANGE_LABELS`, `CUSTOMER_DETAIL_MISSING_DATA_DESCRIPTION`. |
| `apps/admin/src/entities/customer/customer.mapper.ts` | `toCustomerDetailViewModel` plus four group builders; every `null` becomes `—`, every timestamp goes through `lib/date.ts`. |
| `apps/admin/src/pages/customers/customers.interface.ts` | `CustomerTab`, `CustomerTabDefinition`, `CustomerTabsProps`, `CustomerTabPanelProps`, `CustomerDetailState`, `CustomerDetailStateInput`. |
| `apps/admin/src/pages/customers/customers.const.ts` | The tab contract (`CUSTOMER_DETAIL_TABS`, derived `CUSTOMER_TAB_VALUES`, default tab, param names) and all detail copy. |
| `apps/admin/src/pages/customers/customers.logic.ts` | `toCustomerDetailState` — frozen branch order, testable without React. |
| `apps/admin/src/pages/customers/ui/CustomerTabs.tsx` | **New.** Labelled `<nav>` of `Button`s, `aria-current="page"` on the active tab (navigation, not a `tablist`). |
| `apps/admin/src/pages/customers/ui/CustomerOverviewTab.tsx` | **New.** Status badge + `DescriptionList` (change date, primary contact, last activity) + missing-data `Alert`. |
| `apps/admin/src/pages/customers/ui/CustomerDataTab.tsx` | **New.** Four `Card`s with `DescriptionList columns={2}` (`D12`). |
| `apps/admin/src/pages/customers/ui/customer-tab-panels.tsx` | **New.** The total tab → panel record plus the shared placeholder for the four later tabs. |
| `apps/admin/src/pages/customers/CustomerDetailPage.tsx` | **New.** `PageShell` + back link + five surfaces + tab frame + `<Outlet/>` for the AIS-179 overlays. |
| `apps/admin/src/app/router/route-registry.tsx` | The `/customers/:id` entry: **sibling** of the list (`D14`), `navLabel: null`, crumb resolved from the `:id` segment. |
| `apps/admin/src/test/mocks/handlers/customers.handlers.ts` | `customersDetailSuccess` / `customersDetailNotFound` / `customersDetailServerError`, `CUSTOMER_DETAIL_FIXTURE`; the success handler joined the default set. |
| `apps/admin/src/features/customers/use-customer-detail.test.tsx` | **New.** loading, success, `404`, `500`, disabled query, retry. |
| `apps/admin/src/pages/customers/CustomerDetailPage.test.tsx` | **New.** loading, success, `404` copy, `500` + retry, deep-linked tab, one URL write per tab click, unknown `?tab=` fallback. |
| `apps/admin/src/pages/customers/ui/CustomerTabs.test.tsx` | **New.** labels/order, landmark name, `aria-current`, reported value. |
| `apps/admin/src/entities/customer/customer.mapper.test.ts` | Detail mapper cases: group order, label tables, placeholders, formatted timestamps, blank-as-absent. |
| `apps/admin/src/pages/customers/customers.logic.test.ts` | `toCustomerDetailState` — all seven branches. |
| `apps/admin/src/app/router/route-registry.test.ts` | Pins the detail entry: sibling, unlinked, protected, resolved crumb. |
| `docs/Specs/UI-Architecture.md` | Header date line + a §5 paragraph describing the detail page's state ownership and surfaces. |
| `docs/Specs/Customers-Admin-Screens.md` | Header date line, §10 file-map ✅ marks and a "Delivered by AIS-20" block. |

## Deviation from the plan

The plan named the panel registry `ui/customer-tab-content.tsx`; it shipped as
`ui/customer-tab-panels.tsx`, because the file exports a panel **registry**, not content. Nothing else
departs from the plan.

A `CustomerTab` literal union lives in `customers.interface.ts` rather than being derived from the
constant: deriving it made the two files circular (`TS2456`), so the constant now checks itself against
the union with `satisfies` and the panel record is total over it.

## Verification

```text
pnpm -C apps/admin typecheck         -> clean
pnpm -C apps/admin lint              -> clean
pnpm quality                         -> layers, dead-code (knip), palette, themes, field-errors, docs: 0 violations
pnpm typecheck                       -> all packages clean
pnpm -C apps/admin test              -> 64 files, 706 tests passed
```

## Follow-ups

- AIS-21: the header's *Szerkesztés* link, the status-change menu and the archive confirmation (already
  implemented as `useArchiveCustomerMutation`); tag chips on the `data` tab.
- AIS-179 / AIS-181: replace the four placeholder entries in `ui/customer-tab-panels.tsx`; add the
  contact/invite/vault overlays as `children` of the detail registry entry (the page already renders
  `<Outlet/>`).
- The breadcrumb cell of the detail shows the raw `:id` segment, per the screen contract (the crumb is
  URL-derived and must not read data). A `customerNumber` crumb would need a data-aware breadcrumb.
