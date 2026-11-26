# AIS-147 — Sticky, two-band admin header

**Date:** 2026-11-06
**Ticket:** AIS-147 (subtask of AIS-140)
**Plan:** [`2026-11-06--20-33-00-ais-147-sticky-two-band-admin-header-plan.md`](../plans/2026-11-06--20-33-00-ais-147-sticky-two-band-admin-header-plan.md)
**Milestone:** [`2026-11-06--21-05-00-ais-147-sticky-two-band-header.milestone.md`](../milestones/2026-11-06--21-05-00-ais-147-sticky-two-band-header.milestone.md)

## What changed

The single-row, non-sticky, `max-w-5xl`-centred admin header is gone. The shell now has a
**sticky, fixed-height, two-band, full-bleed** header and a full-bleed `<main>`.

| Band   | Left                                   | Right                                      |
| ------ | -------------------------------------- | ------------------------------------------ |
| `h-14` | brand `Link` (`APP_BRAND_LABEL` → `/`) | appearance selector + settings icon button |
| `h-10` | `AdminNav`                             | `AppBreadcrumb`                            |

### New files (`apps/admin/src/app/layout/`)

| File                                                                                | Purpose                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout.const.ts`                                                                   | the header contract: `ADMIN_HEADER_Z_INDEX` (`z-30`), the two band heights, `px-6`, the settings/legend copy, the three `ThemeOption` values and labels, `DEFAULT_THEME_OPTION`, `THEME_SELECTOR_OPTIONS`, `THEME_OPTION_ICONS` |
| `theme-selector.interface.ts`                                                       | `ThemeOption`, `ThemeOptionEntry`, `ThemeSelectorProps`                                                                                                                                                                         |
| `theme-selector.logic.ts`                                                           | `toThemeRadioOptions()` (pure, builds `RadioOption[]` with icons) and `toThemeOption()` (narrows the primitive's `string` to the union)                                                                                         |
| `theme-selector.errors.ts`                                                          | `InvalidThemeOptionError`                                                                                                                                                                                                       |
| `ui/ThemeSelector.tsx`                                                              | horizontal `RadioGroup`, three icon options, local `useState`, `onThemeChange` port                                                                                                                                             |
| `admin-header.interface.ts`                                                         | `AdminHeaderProps` (`routes` + `onThemeChange`)                                                                                                                                                                                 |
| `AdminHeader.tsx`                                                                   | the sticky header itself                                                                                                                                                                                                        |
| `AdminHeader.test.tsx`, `ui/ThemeSelector.test.tsx`, `theme-selector.logic.test.ts` | the new tests                                                                                                                                                                                                                   |

### Modified

| File                                             | Change                                                                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/admin/src/app/layout/AdminLayout.tsx`      | renders `<AdminHeader />`, `<main>` is `w-full flex-1 px-6 py-8`, the AIS-140 `TODO` marker removed, `NOOP_THEME_CHANGE` added as the documented port implementation |
| `apps/admin/src/app/layout/AdminLayout.test.tsx` | full-bleed `<main>`, sticky header, breadcrumb+navigation in the second band, log-drawer handle queried **by name**                                                  |
| `docs/Specs/UI-Architecture.md`                  | §4.1 `app/layout` row, a new `app/layout` row in the §5 state plan, `Utolsó frissítés` bumped                                                                        |

## Decisions worth remembering

- **`z-30`**, from a constant: the header must stay **below** the log drawer (`z-40`), the dialog
  (`z-50`) and the toast (`z-60`). A hard-coded value in the JSX would have had no way to state that.
- **No JSX in `.const.ts`**: `THEME_OPTION_ICONS` stores icon _components_, and the selector renders
  `<Icon />` — that keeps one constant file and no extra presentational component.
- **The theme selector applies nothing.** Local `useState`, an `onThemeChange` port filled with an
  empty module-scope function, no `data-theme`, no storage write (AIS-140 `D3`). The test asserts the
  absence of those side effects, so a later change cannot sneak them in unnoticed.
- **`DEFAULT_THEME_OPTION` is also the dark value**, because the shipped token set _is_ the dark one.
  Splitting the two constants made `knip` report a duplicate export, and two names for one value are
  a drift hazard.
- **The settings button is inert** (`aria-label`, no `onClick`, no navigation — AIS-140 `D4`).

## Gates

| Command                                                        | Result                     |
| -------------------------------------------------------------- | -------------------------- |
| `pnpm --filter @callback/admin test`                           | 43 files, 469 tests passed |
| `pnpm --filter @callback/admin typecheck`                      | clean                      |
| `pnpm --filter @callback/admin lint`                           | clean                      |
| `pnpm quality` (layers, dead-code, tokens, field-errors, docs) | 0 violations               |

## Still manual

There is no browser E2E harness in the repo, so the sticky/scrolling behaviour, the visual rhythm of
the two bands and the overlay stacking were verified in `pnpm dev` on `/api-keys` and
`/api-keys/<id>` instead of a test: the header stays put while scrolling, the height does not jump,
the nav and breadcrumb sit in the second row, the selector shows three icon options, the settings
button is focusable, and the log drawer / toast appear **above** the header.
