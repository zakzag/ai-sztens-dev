# Milestone — `PageShell`: one page frame for every admin page (AIS-171)

**Date:** 2026-11-08 · **Ticket:** AIS-171 · **Parent:** AIS-170

## Problem / feature

The admin app had four hand-written copies of the same page frame — `<section className="space-y-6">`
plus an `<h1>`, a subtitle and sometimes a back link — each with slightly different wrapping
(`ApiKeysPage`, `ApiKeyDetailPage`, `PlaceholderPage`, and two markup literals inside the route
registry). Every new entity page would have invented a fifth variant.

## Measured data / evidence

`rg 'text-2xl font-bold text-text-primary|<h1' apps/admin/src` before the change returned four hits:
`ApiKeysPage.tsx:76`, `ApiKeyDetailPage.tsx:214` (with `mt-2`), `PlaceholderPage.tsx:14` (no
`space-y-6` on the section, `mt-3` paragraph) and `LoginPage.tsx:24` (`text-xl`, outside the layout).
`route-registry.tsx` carried two page literals: `element: <p className="text-text-secondary">` for
`/calls` and for the catch-all.

## Root cause / design rationale

There was no page-frame primitive, so "how a page starts" was knowledge duplicated in call sites. The
considered alternatives for the two slot-like extras:

| Alternative                                              | Why not                                                                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `back?: { to: string; label: string }` + internal `Link` | Would force `react-router` into `packages/ui`, which no primitive may import                                         |
| `backHref?: string` + plain `<a>`                        | Loses client-side navigation and the `aria-label` the page owns today                                                |
| Keep the frame per page, share only a class constant     | A class string cannot express "one `h1`", the header row or the slot order                                           |
| **`back?: ReactNode` / `actions?: ReactNode` slots**     | Chosen: the page injects its own `Link`, the package stays router-free (same pattern as `Breadcrumb`'s `renderLink`) |

`ApiKeyDetailPage` was migrated even though AIS-173 deletes it: it is the only real `back` consumer,
so the slot is exercised by production code instead of only by tests.

## Solution / implementation

| File                                                                            | Change                                                                              |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/ui/src/components/page-shell/page-shell.interface.ts`                 | `PageShellProps`: `title`, `subtitle?`, `back?`, `actions?`, `children`             |
| `packages/ui/src/components/page-shell/PageShell.tsx`                           | The frame; slots render only when supplied (an empty wrapper would shift the title) |
| `packages/ui/src/index.ts`                                                      | Explicit `PageShell` + `PageShellProps` export                                      |
| `packages/ui/test/page-shell.test.tsx` + `test/mocks/page-shell-slots.mock.tsx` | 9 tests incl. slot placement, no-wrapper case, token-only classes, axe              |
| `apps/admin/src/pages/api-keys/ApiKeysPage.tsx`                                 | `PageShell` + the create `Link` as `actions`                                        |
| `apps/admin/src/pages/api-keys/ApiKeyDetailPage.tsx`                            | `PageShell` + the back `Link` as `back`                                             |
| `apps/admin/src/pages/PlaceholderPage.tsx`                                      | `PageShell`, `BuildInfoFooter` as `children`, stale copy fixed                      |
| `apps/admin/src/pages/calls/*`, `pages/not-found/*`                             | New page folders replacing the two registry literals                                |
| `apps/admin/src/app/router/route-registry.tsx`                                  | Mounts components; no page markup left                                              |
| `apps/admin/src/app/app.const.ts`                                               | `APP_NOT_FOUND_MESSAGE` removed (page owns the copy)                                |
| `docs/Specs/UI-Architecture.md`                                                 | §4 row, §5 state-plan rows + "every page renders through `PageShell`" note          |

## Outcome and how to verify

`apps/admin/src` no longer contains a hand-written page title; the `h1` of a route comes from
`PageShell`, and the route registry holds data only.

```bash
pnpm --filter @callback/ui test
pnpm --filter @callback/admin test
pnpm typecheck
pnpm quality
```

Manual: `/api-keys` (title + right-hand action), `/api-keys/<id>` (back link above the title),
`/calls`, an unknown URL, and `/` (deploy footer still visible).

## Follow-ups

- AIS-172 / AIS-173 move edit and delete into overlays; AIS-173 deletes `ApiKeyDetailPage`, so the
  `back` slot then has no production consumer until the next detail page arrives.
- `LoginPage` stays outside the shell (renders outside `AdminLayout`); the exception is documented in
  `docs/Specs/UI-Architecture.md` §5 and owned by AIS-174.
- `packages/ui` has no automated guard against a page re-introducing a hand-written `<h1>`; today only
  review catches it.
