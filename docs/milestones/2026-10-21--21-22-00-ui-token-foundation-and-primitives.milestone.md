# UI token foundation and primitives (`packages/ui`)

**Date:** 2026-10-21
**Jira:** AIS-61 (parent: AIS-57)
**Plan:** [`2026-10-21--20-40-00-ais-57-ais-41-admin-api-keys-page-plan.md`](../plans/2026-10-21--20-40-00-ais-57-ais-41-admin-api-keys-page-plan.md) §Fázis 3
**History:** [`2026-10-21--21-22-00-ais-61-ui-token-primitives.md`](../history/2026-10-21--21-22-00-ais-61-ui-token-primitives.md)

## 1. Feature / problem

The admin SPA had no shared visual layer: colours were Tailwind palette
utilities scattered through `App.tsx`, `LoginPage.tsx`, `PlaceholderPage.tsx`
and `BuildInfoFooter.tsx`. The upcoming `api-keys` page (AIS-41) needs buttons,
inputs, cards, tables, badges and alerts that look and behave identically, and
the rule set (`.roo/rules/react.coding-standards.md` §7) forbids palette
utilities and colour literals in `apps/*/src`. Without a token layer every new
page would re-invent the palette.

## 2. Evidence

```text
apps/admin/src/index.css          @apply bg-slate-950 text-slate-100
apps/admin/src/App.tsx            border-slate-800 bg-slate-900 text-white text-slate-400
apps/admin/src/pages/LoginPage    ring-slate-800 bg-indigo-600 hover:bg-indigo-500 …
apps/admin/src/.../BuildInfoFooter text-slate-500
```

`packages/ui` did not exist. There was no way to satisfy the DoD check
(`#[0-9a-fA-F]{3,8}|(bg|text|border|ring|…)-(slate|gray|…)-NNN` must return
nothing) by patching pages one by one.

## 3. Design rationale

| Decision                                                                                  | Alternative considered                 | Why                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source-only `packages/ui` (`exports` → `src/index.ts`, no `dist`)                         | tsc build like `packages/shared`       | Its only consumer is a Vite bundle; a `dist` adds build ordering plus a second copy of the classes for Tailwind to miss. Consumers type-check the sources through `tsc --noEmit`. |
| Tokens in one CSS file (`styles/theme.css`) via `@theme`                                  | a TS token object generating classes   | Tailwind must see real CSS custom properties; a TS layer would duplicate the source of truth.                                                                                     |
| `border-hairline`, `border-strong`, `duration-fast`, `duration-base` as custom `@utility` | use `border`/`border-2`/`duration-150` | Tailwind v4 has no theme namespace for border width or duration, and the rule set names these semantic utilities.                                                                 |
| CVA + `cn()` per primitive                                                                | hand-written conditional class strings | variants stay declarative and `className` overrides merge deterministically (last wins).                                                                                          |
| `Button` defaults to `type="button"`                                                      | rely on the HTML default (`submit`)    | an implicit submit inside a long form is a classic silent bug.                                                                                                                    |
| `Input` requires `id`                                                                     | generated ids (`useId`)                | deterministic label association in tests and DOM; the caller owns the field identity.                                                                                             |
| `Alert` uses a thick coloured border, text stays `text-text-primary`                      | coloured text on a tinted surface      | severity then never depends on a contrast-critical foreground colour.                                                                                                             |

## 4. Implementation

| File                                                                                                           | Change                                                                                                   |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/ui/package.json`                                                                                     | new source-only workspace package (`@callback/ui`), CVA/clsx/tailwind-merge deps, `test`/`build` scripts |
| `packages/ui/tsconfig.json`, `vitest.config.ts`                                                                | type check + jsdom test run                                                                              |
| `packages/ui/src/styles/theme.css`                                                                             | `@theme` colour/depth/shape/motion tokens, `@utility` thickness + duration, base `body` surface          |
| `packages/ui/src/lib/cn.ts`                                                                                    | `clsx` + `tailwind-merge` merge helper                                                                   |
| `packages/ui/src/components/{button,input,card,table,badge,alert}/**`                                          | six primitives, each with `.variants.ts` and `.interface.ts`                                             |
| `packages/ui/src/index.ts`                                                                                     | explicit exports (no `export *`)                                                                         |
| `packages/ui/test/**`                                                                                          | 47 tests: render + every variant + error/loading/aria branches                                           |
| `apps/admin/package.json`                                                                                      | adds `@callback/ui`                                                                                      |
| `apps/admin/src/index.css`                                                                                     | imports the token file, registers `@source "../../../packages/ui/src"`, drops the palette `@apply`       |
| `apps/admin/src/App.tsx`, `pages/LoginPage.tsx`, `pages/PlaceholderPage.tsx`, `components/BuildInfoFooter.tsx` | migrated to tokens; `LoginPage` now composed from `Card`/`Input`/`Button`                                |
| `package.json` (root)                                                                                          | `test` also runs `@callback/api-client`, `@callback/ui`, `@callback/admin`                               |
| `docs/Specs/UI-Architecture.md`                                                                                | new living spec: layers, tokens, primitives, dependency list, DoD check                                  |

## 5. Outcome and verification

`apps/admin/src` contains no colour literal and no palette utility; every
colour comes from `packages/ui/src/styles/theme.css`.

```bash
pnpm --filter @callback/ui test        # 47 passed
pnpm --filter @callback/ui build       # tsc --noEmit, exit 0
pnpm --filter @callback/admin test     # 1 passed
pnpm --filter @callback/admin lint     # exit 0
pnpm --filter @callback/admin build    # exit 0, CSS 15.58 kB
```

The emitted `apps/admin/dist/assets/*.css` must contain `shadow-neu-raised`,
`bg-primary`, `border-hairline`, `duration-fast`, `rounded-control`,
`bg-info`, `text-text-muted` — proof that Tailwind scanned `packages/ui`.

Manual check: `pnpm --filter @callback/admin dev` → the login screen renders on
the dark neomorphic surface with a sunken password field and a raised primary
button (no unstyled elements).

## 6. Follow-ups

- Visual/contrast pass against WCAG AA once the `api-keys` page exists (AIS-41).
- ESLint config for `packages/ui` (currently only `apps/admin` lints).
- Slider/checkbox/select primitives are not built yet — add them when a page
  first needs them, not before.
