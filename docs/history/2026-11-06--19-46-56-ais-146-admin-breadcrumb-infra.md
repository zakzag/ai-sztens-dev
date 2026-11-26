# AIS-146 — breadcrumb data model + pure derivation logic from the route registry

**Date:** 2026-11-06 · **Parent:** AIS-140 · **Plan:** [`2026-11-06--19-33-12-ais-146-admin-breadcrumb-route-registry-plan.md`](../plans/2026-11-06--19-33-12-ais-146-admin-breadcrumb-route-registry-plan.md)
**Prerequisite delivered:** AIS-145 (`Breadcrumb` primitive), AIS-144 (`ChevronRightIcon`)

## What was built

The admin breadcrumb is **derived**, never hand-written: the route registry declares each crumb and
its parent, one pure function builds the trail, and `AppBreadcrumb` only wires the router to the
primitive.

## Changed files

| File | Change |
| --- | --- |
| [`route-entry.interface.ts`](../../apps/admin/src/app/router/route-entry.interface.ts:14) | three new readonly fields: `breadcrumbLabel` (required, `string \| null`), `breadcrumbParentPath?`, `resolveBreadcrumbLabel?` — English JSDoc, AIS-140 `D5` |
| [`app.const.ts`](../../apps/admin/src/app/app.const.ts:27) | `APP_API_KEYS_LABEL`, `APP_CALLS_LABEL` extracted; the nav and the breadcrumb read the same constant |
| [`route-registry.tsx`](../../apps/admin/src/app/router/route-registry.tsx:49) | every entry filled: `/` roots the trail, `/api-keys` and `/calls` hang under `/`, `/api-keys/:identifier` gets a resolver, `/login` and `*` carry `null` |
| [`breadcrumb.interface.ts`](../../apps/admin/src/app/router/breadcrumb.interface.ts:1) | new — `BreadcrumbCrumb` (alias of the UI `BreadcrumbItem`) and `MatchedRoute` |
| [`breadcrumb.const.ts`](../../apps/admin/src/app/router/breadcrumb.const.ts:1) | new — path separator, param prefix, catch-all marker |
| [`breadcrumb.logic.ts`](../../apps/admin/src/app/router/breadcrumb.logic.ts:1) | new — `matchRoute`, `interpolatePath`, `toBreadcrumbItems`; static-first matching, catch-all never matches, cycle-safe walk, missing parent ends the chain |
| [`AppBreadcrumb.tsx`](../../apps/admin/src/app/layout/AppBreadcrumb.tsx:1) + [`app-breadcrumb.interface.ts`](../../apps/admin/src/app/layout/app-breadcrumb.interface.ts:1) | new — `useLocation()` → `toBreadcrumbItems` → `<Breadcrumb>` with a module-scope router `Link` renderer; `routes` injected as a prop |
| [`AdminLayout.tsx`](../../apps/admin/src/app/layout/AdminLayout.tsx:43) | breadcrumb mounted in a second row of `<header>` with a `TODO(AIS-140)` marker |
| [`route-registry.mock.tsx`](../../apps/admin/src/test/mocks/route-registry.mock.tsx:1), [`breadcrumb-routes.mock.tsx`](../../apps/admin/src/test/mocks/breadcrumb-routes.mock.tsx:1) | mocks updated / new fixture registry for every branch |
| [`AppRouter.test.tsx`](../../apps/admin/src/app/router/AppRouter.test.tsx:23) | literals updated, navigation queries made name-based (the shell now renders two landmarks) |
| `breadcrumb.logic.test.ts`, `AppBreadcrumb.test.tsx`, `route-registry.test.ts`, `AdminLayout.test.tsx` | new 27 + 6 tests, 5 new registry invariants, 1 new layout test |

## Decisions that deviate from (or sharpen) the ticket

| # | Decision | Why |
| --- | --- | --- |
| D4 | `AppBreadcrumb` does **not** use `useParams()`; params come from the pattern match | the layout renders inside `<Route path="/*">`, so `useParams()` only exposes the splat — `params.identifier` would be `undefined` |
| D2 | inclusion test is `breadcrumbLabel !== null \|\| resolveBreadcrumbLabel !== undefined` | the detail route needs a resolver and no static text; `null` alone cannot mean "excluded" |
| D1 | `breadcrumbLabel` is required | a new route cannot silently ship without a crumb |
| D3 | `BreadcrumbCrumb` aliases the UI `BreadcrumbItem` | one shape, no drift |
| D6 | a parent template param the leaf cannot fill renders as text, not a dead link | `interpolatePath` returns `undefined` |
| D10 | one wording constant per route | the nav and the breadcrumb can never show two names |

## Verification

```bash
pnpm --filter @callback/admin test   # 40 files, all green
pnpm test                            # shared 335, ui, admin 40 files, api 433
pnpm typecheck                       # all 8 workspaces
pnpm lint
pnpm quality                         # layers, dead-code, tokens, field-errors, docs → 0 violations
```

Manual check: open `/api-keys/<identifier>` — the trail reads `Kezdőlap / API kulcsok / <identifier>`,
only the first two are links, the last has `aria-current="page"`. An unknown URL renders no
`Útvonal` landmark at all.
