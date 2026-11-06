# Milestone — Sticky, two-band admin header (AIS-147)

**Date:** 2026-11-06 · **Ticket:** AIS-147 (subtask of AIS-140)
**Related:** [`UI-Architecture.md`](../Specs/UI-Architecture.md:557) §4.1 and §5

## 1. Problem

The admin shell had one non-sticky header row (`border-b`, `mx-auto max-w-5xl`) with the brand and the
navigation side by side, and a `<main>` that was centred on a `max-w-5xl` column. There was no
appearance selector, no settings button, and the breadcrumb shared the row with the brand. The story
required a shell that stays put while scrolling, separates _identity/actions_ from _navigation/location_,
and spans the full viewport width.

## 2. Evidence

| Observation                                                      | Source                                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Header not sticky, `max-w-5xl`                                   | `apps/admin/src/app/layout/AdminLayout.tsx` before the change (line 44–59) |
| `<main>` centred on `max-w-5xl`                                  | same file, line 61                                                         |
| No `data-theme`, single dark token set                           | `packages/ui/src/styles/theme.css`                                         |
| Overlay stacking: log drawer `z-40`, dialog `z-50`, toast `z-60` | `packages/ui/src/components/{log-drawer,dialog,toast}/*.const.ts`          |

## 3. Root cause / design rationale

The shell was written for one page (`api-keys`) and grew a nav by appending to the same row. Nothing
in the code stated a stacking contract, so a fixed header could have been added without noticing that
the overlays already occupy `z-40…z-60`.

Decisions taken (AIS-140 `D1`–`D11`, implemented here):

| Decision                                                   | Reason                                                                                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Two bands, `h-14` + `h-10`, both from constants            | Fixed height + `sticky top-0` means a height derived from padding would let the shell shift while scrolling                                                                          |
| `z-30` for the header                                      | Must stay below drawer/dialog/toast; a constant makes the ordering explicit and testable                                                                                             |
| Full bleed (`px-6`, no `max-w-*`)                          | The header spans the viewport, so the content column must share its left edge                                                                                                        |
| Appearance selector: `RadioGroup`, icons, local `useState` | `SelectOption.label` is a `string` rendering native `<option>`, which cannot hold an SVG; the state is neither URL- nor server-owned, so it stays local and disappears on navigation |
| `onThemeChange` port filled with an empty function         | The theme implementation (`data-theme`, token overrides, persistence, flash-free boot) is out of scope; the UI contract ships now                                                    |
| Icon components stored in a constant, not JSX              | A `.const.ts` cannot hold JSX; the selector renders `<Icon />` from the map                                                                                                          |
| `DEFAULT_THEME_OPTION` **is** the dark value               | The shipped token set is dark; two constants for one value tripped `knip`'s duplicate-export check                                                                                   |

## 4. Solution

New `apps/admin/src/app/layout/` files: `layout.const.ts`, `theme-selector.interface.ts`,
`theme-selector.logic.ts`, `theme-selector.errors.ts`, `ui/ThemeSelector.tsx`,
`admin-header.interface.ts`, `AdminHeader.tsx`, plus three test files.

Modified: `AdminLayout.tsx` (renders `AdminHeader`, full-bleed `<main>`, no-op theme port),
`AdminLayout.test.tsx` (band assertions, named log-drawer handle queries),
`docs/Specs/UI-Architecture.md` (§4.1 row, §5 state-plan row, last-updated date).

## 5. Outcome and verification

Header is `sticky top-0 z-30`, fixed height, two bands, full bleed; `<main>` is `w-full px-6 py-8`;
breadcrumb and navigation live in the second band; the selector shows three icon options and applies
nothing; the settings button is focusable and inert.

```bash
pnpm --filter @callback/admin test      # 43 files, 469 tests
pnpm --filter @callback/admin typecheck
pnpm --filter @callback/admin lint
pnpm quality                            # layers, dead-code, tokens, field-errors, docs
```

Manual (`pnpm dev`), because the repo has no browser E2E harness: open `/api-keys` and
`/api-keys/<id>`, scroll — the header must not move and must not change height; the nav and breadcrumb
must be in the second row; the log drawer and a toast must paint **above** the header.

## 6. Follow-ups

- Real theming: `[data-theme]` token overrides, `color-scheme`, persistence, flash-free boot.
- User-settings menu behind the inert button (profile, logout, settings page).
- The `h-14` band holds a `<legend>` + one radio row; on a very narrow viewport the legend makes the
  band tight. Revisit if the header is measured in a narrow-viewport pass.
