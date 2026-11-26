# AIS-147 — Sticky, two-band admin header (plan)

**Ticket:** [AIS-147](https://zakzag.atlassian.net/browse/AIS-147) (subtask of AIS-140)
**Status:** planned
**Date:** 2026-11-06

## Preconditions verified in the repo

| Dependency                                      | State                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AIS-144 icons + `RadioOption.icon`              | done — [`icons.tsx`](../../packages/ui/src/components/icon/icons.tsx:39) exports `SunIcon` / `MoonIcon` / `SunsetIcon` / `SettingsIcon` / `ChevronRightIcon`; `RadioOption.icon` exists in [`radio-group.interface.ts`](../../packages/ui/src/components/radio-group/radio-group.interface.ts:22) |
| AIS-145 `Breadcrumb` primitive                  | done — [`Breadcrumb.tsx`](../../packages/ui/src/components/breadcrumb/Breadcrumb.tsx:1) + `BREADCRUMB_DEFAULT_ARIA_LABEL` exported from `@callback/ui`                                                                                                                                            |
| AIS-146 breadcrumb data model + `AppBreadcrumb` | done — [`breadcrumb.logic.ts`](../../apps/admin/src/app/router/breadcrumb.logic.ts:1), [`AppBreadcrumb.tsx`](../../apps/admin/src/app/layout/AppBreadcrumb.tsx:40) already inside `<header>`                                                                                                      |

So AIS-147 is **layout work only**; no `packages/ui` change, no new dependency, no `zustand`.

## Target structure

```text
<header sticky top-0 z-30 border-b bg-surface-raised>
  row 1  h-14 px-6  |  brand Link           |  ThemeSelector + settings Button
  row 2  h-10 px-6  |  AdminNav (nav)       |  AppBreadcrumb (nav)
</header>
<main w-full flex-1 px-6 py-8>            ← max-w-5xl removed
```

`AppErrorBanner` stays **above** the header and stays **non-sticky** (AIS-140 `D7`).

## Files

### 1. `apps/admin/src/app/layout/layout.const.ts` (new)

Shell geometry, labels and theme option values — no colour literal, no inline class in JSX.

- `ADMIN_HEADER_Z_INDEX = 'z-30'` (below `LOG_DRAWER_Z_INDEX` `z-40` and `DIALOG_CONTENT_Z_INDEX` `z-50`)
- `ADMIN_HEADER_TOP_ROW_HEIGHT = 'h-14'`, `ADMIN_HEADER_CRUMB_ROW_HEIGHT = 'h-10'`, `ADMIN_HEADER_PADDING_X = 'px-6'`
- `APP_USER_SETTINGS_ARIA_LABEL`, `THEME_SELECTOR_LEGEND`
- `THEME_SELECTOR_NAME` (the `RadioGroup` `name`), `THEME_OPTION_LIGHT/DARK/AMBIENT` values + `_LABEL` copy, `DEFAULT_THEME_OPTION = THEME_OPTION_DARK`
- `THEME_SELECTOR_OPTIONS: readonly ThemeOptionEntry[]` — `{ value, label }` only (a `.const.ts` cannot hold JSX)
- `THEME_OPTION_ICONS: Record<ThemeOption, ComponentType<IconProps>>` — maps value → icon **component reference**, rendered as `<Icon />` in the selector (keeps JSX out of the const file, satisfies `knip`)

### 2. `apps/admin/src/app/layout/theme-selector.interface.ts` (new)

`ThemeOption` union + `ThemeOptionEntry` + `ThemeSelectorProps { readonly onThemeChange: (value: string) => void }`.

### 3. `apps/admin/src/app/layout/ui/ThemeSelector.tsx` (new)

- `RadioGroup` — `orientation="horizontal"`, `legend={THEME_SELECTOR_LEGEND}`, `name={THEME_SELECTOR_NAME}`, three options, each carrying `icon: <Icon className="h-4 w-4" aria-hidden />`.
- Local `useState(DEFAULT_THEME_OPTION)` **only** for the visual selection.
- `handleChange(value)` = `setSelected(value)` + `onThemeChange(value)`.
- **No** effect, **no** `<html>` attribute, **no** `localStorage` / `sessionStorage` (AIS-140 `D3`, `D11`).

### 4. `apps/admin/src/app/layout/admin-header.interface.ts` + `AdminHeader.tsx` (new)

`AdminHeaderProps { readonly routes: readonly RouteEntry[]; readonly onThemeChange: (value: string) => void }` — the header never imports the registry (props-driven shell, §4.1).

- `<header className={\`sticky top-0 ${ADMIN_HEADER_Z_INDEX} border-b border-border-hairline bg-surface-raised\`}>`
- Row 1: brand `Link to={APP_ROUTE_HOME_PATH}` with `APP_BRAND_LABEL` + right `div` (`flex items-center gap-4`) holding `ThemeSelector` and the settings `Button type="button" variant="ghost" size="sm" aria-label={APP_USER_SETTINGS_ARIA_LABEL}` → `SettingsIcon`; **no** `onClick`, no navigation (AIS-140 `D4`).
- Row 2: `flex ${ADMIN_HEADER_CRUMB_ROW_HEIGHT} items-center justify-between gap-6 border-t border-border-hairline ${ADMIN_HEADER_PADDING_X}` → `AdminNav`, `AppBreadcrumb`.
- No colour literal, no palette utility, no arbitrary colour.

### 5. `apps/admin/src/app/layout/AdminLayout.tsx` (edit)

- Header markup replaced by `<AdminHeader routes={routes} onThemeChange={NOOP_THEME_CHANGE} />`; the noop is a documented module-scope constant (one identity, no re-render churn) with a comment that theme application is **not** in this story.
- `<main className="w-full flex-1 px-6 py-8">` — `mx-auto max-w-5xl` removed.
- `AppErrorBanner` and `<NotificationHost />` unchanged; remove the `TODO(AIS-140)` marker.

## Tests

- `AdminHeader.test.tsx` (new): `sticky top-0` + `ADMIN_HEADER_Z_INDEX`; both row heights come from the constants; brand `role="link"`, name = `APP_BRAND_LABEL`, `href="/"`; row 2 holds the nav (`role="navigation"`, `APP_NAV_LABEL`) **and** the breadcrumb (`BREADCRUMB_DEFAULT_ARIA_LABEL`); settings button `role="button"`, name = `APP_USER_SETTINGS_ARIA_LABEL`, click does not throw and does not change `location.pathname`.
- `ThemeSelector.test.tsx` (new): three radios with label + icon, default `Sötét` checked; selecting another option moves `checked` **and** calls the `onThemeChange` spy with that value; no side effect — `<html>` has no `data-theme`/`style`, `localStorage.length` and `sessionStorage.length` stay `0`.
- `AdminLayout.test.tsx` (update): breadcrumb region sits in the second band; `<main>` has no `max-w-5xl`; the log-drawer handle is queried **by name** (`LOG_DRAWER_OPEN_LABEL` / `LOG_DRAWER_CLOSE_LABEL`) because the settings button makes an unnamed `getByRole('button')` ambiguous; notification host still mounts and still throws without a provider.

## Documentation

- [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:557) §4.1 `app/layout/` row: `AdminHeader.tsx`, `ui/ThemeSelector.tsx`, `layout.const.ts`, plus the sticky/z-index rule.
- `…` §5 state plan: one `app/layout` entry — theme selection is a **local** `useState`, no store, no persistence (AIS-140 `D3`).
- `Utolsó frissítés` bump.
- `docs/history/<timestamp>-ais-147-sticky-admin-header.md` after implementation.
- Milestone `docs/milestones/<timestamp>-ais-147-sticky-two-band-header.milestone.md` (layout decision + z-index contract) unless AIS-140 already produced one.

## Verification

- `pnpm --filter @callback/admin test`, `pnpm test`, `pnpm test:quality`
- `pnpm typecheck`, `pnpm lint`, `pnpm quality` (tokens, layers, dead-code, field-errors, docs)
- Manual `pnpm dev` on `/api-keys` and `/api-keys/<id>`: header stays put while scrolling, fixed height, nav + breadcrumb in row 2, three icon options, settings button focusable, log drawer and toast render **above** the header.

## Out of scope

Real theming (`data-theme`, token overrides, persistence, flash-free boot), the user-settings menu, entity names in breadcrumbs (AIS-140 `D6`).
