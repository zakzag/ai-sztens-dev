# Breadcrumb params must come from the route pattern, not `useParams()`

**Date:** 2026-11-06 · **Ticket:** AIS-146 (parent AIS-140) · **Area:** `apps/admin` shell

## Problem

The admin received a breadcrumb (AIS-145 primitive + AIS-146 data model). The ticket asked the
component to read the dynamic segment with `useLocation()` **and** `useParams()`, then hand
`params` to the registry's `resolveBreadcrumbLabel`. Implemented literally, `/api-keys/abc123`
would have rendered `undefined` as the last crumb on every detail page.

## Measured data / evidence

- `AdminLayout` is the element of `<Route path="/*">` in [`AppRouter.tsx`](../../apps/admin/src/app/router/AppRouter.tsx:31).
- React Router v6 scopes `useParams()` to the **closest** `RouteContext`. Inside the layout that is
  the `/*` route, so the hook returns `{ '*': 'api-keys/abc123' }`.
- `:identifier` is matched by the *nested* `<Routes>` inside `ProtectedRoutes`
  ([`AppRouter.tsx:67`](../../apps/admin/src/app/router/AppRouter.tsx:67)); its params are visible
  only to components rendered by that matched element — not to the header above it.
- A test mounted in that exact context ([`AppBreadcrumb.test.tsx`](../../apps/admin/src/app/layout/AppBreadcrumb.test.tsx:1))
  fails with a `useParams()` implementation and passes with the chosen one.

## Root cause / design rationale

A breadcrumb is *hierarchical* information about the URL, and the trail definition already contains
the pattern that produced the URL. Reading the param from the router duplicates knowledge the
matcher must have anyway (it needs the pattern to pick the entry), and duplicates it in a scope
where the value is not available.

Alternatives considered:

1. **Move `AppBreadcrumb` into the routed page element** — every page would have to mount it; the
   "page renders nothing extra" rule disappears.
2. **Pass `params` down from `ProtectedRoutes`** — same layering violation, and the shell would
   learn about a page's params.
3. **Derive the params in the pure logic** (chosen) — `matchRoute(routes, pathname)` returns
   `{ entry, params }`; the component needs only `useLocation()`, and the whole rule stays unit
   testable without a router.

Related decision: an entry is in a trail when `breadcrumbLabel !== null` **or** it has a resolver
(the detail route has no static text and must not be excluded), and a parent template param the leaf
cannot fill renders as plain text instead of a `:param` link.

## Solution / implementation

| File | Change |
| --- | --- |
| [`breadcrumb.logic.ts`](../../apps/admin/src/app/router/breadcrumb.logic.ts:1) | `matchRoute` captures `:param` values; `interpolatePath` fills parent links or returns `undefined`; `toBreadcrumbItems` walks `breadcrumbParentPath` cycle-safely |
| [`breadcrumb.interface.ts`](../../apps/admin/src/app/router/breadcrumb.interface.ts:1) | `MatchedRoute { entry, params }`, `BreadcrumbCrumb` aliased to the UI item |
| [`AppBreadcrumb.tsx`](../../apps/admin/src/app/layout/AppBreadcrumb.tsx:1) | `useLocation()` + `toBreadcrumbItems` + injected router `Link` renderer |
| [`route-entry.interface.ts`](../../apps/admin/src/app/router/route-entry.interface.ts:14) | `breadcrumbLabel` (required), `breadcrumbParentPath?`, `resolveBreadcrumbLabel?` |
| [`route-registry.tsx`](../../apps/admin/src/app/router/route-registry.tsx:49) | all 6 entries filled in; labels shared with `navLabel` through `app.const.ts` |
| [`AdminLayout.tsx`](../../apps/admin/src/app/layout/AdminLayout.tsx:43) | provisional mount in a second header row (`TODO(AIS-140)`) |

## Outcome and how to verify

```bash
pnpm --filter @callback/admin test        # breadcrumb.logic.test.ts (27), AppBreadcrumb.test.tsx (6)
pnpm quality                              # layers, dead-code, tokens, field-errors, docs
```

Manual: open `/api-keys/abc123` → trail `Kezdőlap / API kulcsok / abc123`, exactly two links, the
last crumb has `aria-current="page"`. Open an unknown URL → no `Útvonal` navigation landmark.
Open `/login` → no breadcrumb (public routes render outside the shell).

## Follow-ups

- The `identifier` is shown raw; a human-readable name is AIS-140 `D6`.
- The header is still one row plus the crumb row — the AIS-140 header subtask moves the breadcrumb
  into the second band of the two-row shell; only its position changes.
