# AIS-145 — router-free `Breadcrumb` primitive

**Date:** 2026-11-06 18:46 (Europe/Budapest)
**Ticket:** AIS-145 (subtask of AIS-140)
**Plan:** [`docs/plans/2026-11-06--18-19-00-ais-145-breadcrumb-primitive-plan.md`](../plans/2026-11-06--18-19-00-ais-145-breadcrumb-primitive-plan.md)

## What was done

Added the sixth data-display primitive of the AIS-140 header redesign: a breadcrumb trail that
`packages/ui` can ship **without** importing `react-router`. The link element is injected by the
caller; the component owns only structure and accessibility.

New files:

| File | Content |
| ---- | ------- |
| [`breadcrumb.interface.ts`](../../packages/ui/src/components/breadcrumb/breadcrumb.interface.ts) | `BreadcrumbItem`, `BreadcrumbLinkRendererProps`, `BreadcrumbLinkRenderer`, `BreadcrumbProps` — all `readonly`, JSDoc in English |
| [`breadcrumb.const.ts`](../../packages/ui/src/components/breadcrumb/breadcrumb.const.ts) | `BREADCRUMB_DEFAULT_ARIA_LABEL = 'Útvonal'` + five token-only class recipes |
| [`Breadcrumb.tsx`](../../packages/ui/src/components/breadcrumb/Breadcrumb.tsx) | `<nav aria-label>` → `<ol>` → `<li>` cells, one local `renderCrumb()` helper |
| [`index.ts`](../../packages/ui/src/index.ts:330) | Explicit exports (component, const, four types) |
| [`breadcrumb.test.tsx`](../../packages/ui/test/breadcrumb.test.tsx) | 9 tests (empty, single, three, injected renderer, `to`-less crumb, separators, aria label, axe, token classes) |
| [`breadcrumb-items.mock.ts`](../../packages/ui/test/mocks/breadcrumb-items.mock.ts) | Three trail fixtures |
| [`breadcrumb-link-renderer.mock.tsx`](../../packages/ui/test/mocks/breadcrumb-link-renderer.mock.tsx) | Recording renderer stub |

## Decisions

- **D1** injected `renderLink` render prop; `<a href>` fallback when omitted (documented as a *full*
  page navigation, not an SPA one).
- **D2** the last crumb is always `<span aria-current="page">`, never a link — even with a `to`.
- **D3** a non-last crumb without `to` renders as text (its own `BREADCRUMB_STATIC_CLASSES` recipe),
  so no dead, focusable link exists.
- **D4** separators are `<li aria-hidden="true">` cells: `n` crumbs → `2n-1` list items, `n-1`
  chevrons, and `queryAllByRole('listitem')` still returns exactly `n`.
- **D5** empty `items` renders `null` — no empty `<nav>` landmark (axe would flag it).
- **D6** default accessible name comes from an exported constant (same convention as
  `PAGINATION_DEFAULT_ARIA_LABEL`).
- **D7** no separator-size constant: `ICON_BASE_CLASS` already supplies `h-4 w-4` and the icon is
  `aria-hidden` on its own, so the `<li>` only adds the colour token.
- **D8/D9** index-based keys, and no local state/hooks/`useMemo` — the component is a pure mapping.

## Verification

| Gate | Result |
| ---- | ------ |
| `pnpm --filter @callback/ui test` | 43 files / **374 tests** green (9 new) |
| `pnpm --filter @callback/ui typecheck` | clean |
| `pnpm quality` (layers, dead-code, tokens, field-errors, docs) | 0 violations — knip accepts the new entry-point exports |
| `npx prettier --check` on the new TS/TSX | clean (Markdown is not prettier-clean repo-wide, pre-existing) |

Sibling order preserved: AIS-144 (icons) shipped first, AIS-146 (breadcrumb data model) can now
consume the primitive, AIS-147 wires the sticky header.
