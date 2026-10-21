# AIS-61 — `packages/ui` token primitives (implementation)

**Jira:** AIS-61 (Subtask) — parent: AIS-57
**Date:** 2026-10-21
**Plan:** [`docs/plans/2026-10-21--20-40-00-ais-57-ais-41-admin-api-keys-page-plan.md`](../plans/2026-10-21--20-40-00-ais-57-ais-41-admin-api-keys-page-plan.md) (Fázis 3)
**Milestone:** [`docs/milestones/2026-10-21--21-22-00-ui-token-foundation-and-primitives.milestone.md`](../milestones/2026-10-21--21-22-00-ui-token-foundation-and-primitives.milestone.md)

## 1. What was built

The design-token layer and the presentational primitives that the upcoming
`api-keys` page (AIS-41) will be composed from, plus the migration of the three
existing admin files that still used Tailwind palette utilities.

| Area | Result |
|---|---|
| Tokens | `packages/ui/src/styles/theme.css` — brand/surface/border/text/state colours, neomorphic shadows, radii, motion, border thicknesses |
| Class merging | `packages/ui/src/lib/cn.ts` (`clsx` + `tailwind-merge`) |
| Primitives | `Button`, `Input`, `Card`, `Table` (+`TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell`), `Badge`, `Alert` |
| Exports | explicit list in `packages/ui/src/index.ts` (no `export *`) |
| Admin wiring | `@callback/ui` workspace dependency, `index.css` token import + `@source` registration |
| Admin migration | `App.tsx`, `LoginPage.tsx`, `PlaceholderPage.tsx`, `BuildInfoFooter.tsx` |
| Tests | 47 new tests in `packages/ui/test` |
| Docs | new [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md) |

## 2. Files

New (all under [`packages/ui/`](../../packages/ui/)):

| File | Role |
|---|---|
| [`package.json`](../../packages/ui/package.json) | source-only package (`exports` → `src/index.ts`), CVA/clsx/tailwind-merge deps |
| [`tsconfig.json`](../../packages/ui/tsconfig.json), [`vitest.config.ts`](../../packages/ui/vitest.config.ts) | type check + jsdom test run |
| [`src/styles/theme.css`](../../packages/ui/src/styles/theme.css) | `@theme` tokens, `@utility` thickness/duration, base body surface |
| [`src/lib/cn.ts`](../../packages/ui/src/lib/cn.ts) | `cn()` |
| [`src/components/button/`](../../packages/ui/src/components/button/) | `Button.tsx`, `button.variants.ts`, `button.interface.ts` |
| [`src/components/input/`](../../packages/ui/src/components/input/) | `Input.tsx`, `input.variants.ts`, `input.interface.ts` |
| [`src/components/card/`](../../packages/ui/src/components/card/) | `Card.tsx`, `card.interface.ts` |
| [`src/components/table/`](../../packages/ui/src/components/table/) | `Table`, `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell`, `table.interface.ts` |
| [`src/components/badge/`](../../packages/ui/src/components/badge/) | `Badge.tsx`, `badge.variants.ts`, `badge.interface.ts` |
| [`src/components/alert/`](../../packages/ui/src/components/alert/) | `Alert.tsx`, `alert.variants.ts`, `alert.interface.ts` |
| [`src/index.ts`](../../packages/ui/src/index.ts) | explicit exports |
| [`test/`](../../packages/ui/test/) | `setup.ts` + `cn`, `button`, `input`, `card`, `table`, `badge`, `alert` suites |

Modified:

| File | Change |
|---|---|
| [`apps/admin/package.json`](../../apps/admin/package.json) | `@callback/ui: workspace:*` |
| [`apps/admin/src/index.css`](../../apps/admin/src/index.css) | token import + `@source`; palette `@apply` removed |
| [`apps/admin/src/App.tsx`](../../apps/admin/src/App.tsx) | palette classes → tokens; `<div>` text nodes → `<p>` |
| [`apps/admin/src/pages/LoginPage.tsx`](../../apps/admin/src/pages/LoginPage.tsx) | hand-rolled card/input/button → `Card` + `Input` + `Button` |
| [`apps/admin/src/pages/PlaceholderPage.tsx`](../../apps/admin/src/pages/PlaceholderPage.tsx) | palette classes → text tokens |
| [`apps/admin/src/components/BuildInfoFooter.tsx`](../../apps/admin/src/components/BuildInfoFooter.tsx) | `text-slate-500` → `text-text-muted` |
| [`package.json`](../../package.json) (root) | `test` now also runs `@callback/api-client`, `@callback/ui`, `@callback/admin` |

## 3. Design notes / deviations from the plan

* **`@utility` for non-namespaced tokens.** Tailwind v4 has no `--border-width-*`
  or `--duration-*` theme namespace, so the four tokens
  (`border-hairline`, `border-strong`, `duration-fast`, `duration-base`) are
  plain custom properties exposed through custom `@utility` rules. A token name
  such as `border-hairline` does not collide with the colour utilities because
  the border *colour* token resolves to `border-border-hairline`.
* **`Button` defaults to `type="button"`.** An implicit `submit` in a long form
  is a silent bug source; submitting is an explicit opt-in (`type="submit"`).
* **`Input` requires `id`.** The label association stays explicit and testable
  instead of relying on generated ids.
* **`LoginPage` keeps its own `h1`.** `Card` renders `title` as `h2`; the login
  screen needs a page-level heading, so it composes `Card` without `title`.
* **Root `test` script extended** (plan Fázis 2 obligation): it previously ran
  only `shared` + `api`, so a broken UI primitive or admin test would have been
  invisible to `pnpm test`.

## 4. Verification (actual output)

```text
pnpm --filter @callback/ui test
  Test Files  7 passed (7)
       Tests  47 passed (47)

pnpm --filter @callback/ui build            # tsc --noEmit
  (no output, exit 0)

pnpm --filter @callback/admin build
  dist/assets/index-Jc3nP8Dv.css   15.58 kB │ gzip: 3.84 kB
  dist/assets/index-DIW20E5m.js   282.84 kB │ gzip: 86.08 kB
  ✓ built in 16.65s

pnpm --filter @callback/admin lint
  (no output, exit 0)

pnpm --filter @callback/admin test
  Test Files  1 passed (1)   Tests  1 passed (1)

pnpm --filter @callback/api-client test
  Tests: 29 passed, 29 total
```

Bundle check — the emitted admin CSS really contains the primitive/token
utilities (i.e. the Tailwind `@source` registration works):

```text
OK   .shadow-neu-raised
OK   .bg-primary
OK   .border-hairline
OK   .duration-fast
OK   --color-surface-raised
OK   .rounded-control
OK   .bg-info
OK   .text-text-muted
```

Palette / colour-literal check over `apps/admin/src` (`rg` is not installed on
this machine, the equivalent PowerShell `Select-String` was used):

```text
NO MATCHES
```

## 5. Follow-ups

* Tailwind emits `.border-strong`, `.duration-fast` etc. — verify visually in
  the browser once the `api-keys` page exists (AIS-41).
* The `--color-*` palette is a first draft tuned for the dark neomorphic look;
  contrast values were not yet measured against WCAG AA in a browser.
* `packages/ui` has no ESLint config yet (`pnpm -r lint` skips it, like
  `packages/api-client`).
