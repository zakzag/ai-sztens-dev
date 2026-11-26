# AIS-144 — icon set (Lucide SVG) + `RadioOption.icon`

**Ticket:** [AIS-144](https://zakzag.atlassian.net/browse/AIS-144) (subtask of AIS-140)
**Scope:** `packages/ui` + one spec doc. No app code, no new dependency.
**Status:** planned

## Goal

Give the UI kit an icon vocabulary (5 inline Lucide SVGs) and make `RadioGroup`
able to render an icon next to an option label, so AIS-147 can build the
three-option theme picker and the user-settings button, and AIS-145 can use
`ChevronRightIcon` in the breadcrumb.

## Decisions

| #   | Decision                                                                                                                                                                                                                                              | Why                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Every icon carries a **default size class** (`h-4 w-4 shrink-0`) merged with the caller's `className` through `cn()`; there is no `size` prop.                                                                                                        | An SVG with a `viewBox` but no width/height renders at 100% of its container — that is a visual bug, not a "caller's job". `tailwind-merge` lets the caller override with `h-6 w-6` while keeping the API at `className` only. |
| D2  | `RadioGroup` renders the icon **only when `option.icon` is set**; without an icon the JSX tree stays byte-identical.                                                                                                                                 | The ticket's regression requirement. Also keeps the existing `description` `<span class="block">` layout intact — a permanently added flex wrapper would turn the description into a flex sibling. |
| D3  | No icon library, no `packages/ui/package.json` change. Path data is copied from Lucide (ISC) with source URL + licence in each component's JSDoc.                                                                                                     | One shared 24×24 stroke grid, 5 icons, ~1 kB of JSX — a dependency would be bigger than the payload and would add a second styling axis (`size`/`color` props) the tokens already cover via `currentColor`. |
| D4  | Icons are **decorative only**: `aria-hidden="true"` + `focusable="false"` on every `<svg>`, and `RadioGroup` wraps the icon in its own `aria-hidden` span. Accessible name comes from the text, never from the icon.                                  | Prevents "Sun Világos, radio button" double announcement; `focusable="false"` keeps the SVG out of the tab order in older Edge/IE engines.                                                        |
| D5  | Shared SVG attributes live in one place (`icon.const.ts` → `ICON_BASE_CLASS`, plus the common props spread inside `icons.tsx`), not copy-pasted five times.                                                                                           | DRY; a later icon cannot drift on `strokeWidth` or `stroke`.                                                                                                                                     |

## Files

| File                                                            | Change                                                                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/components/icon/icon.interface.ts` **(new)**   | `IconProps { readonly className?: string }` — JSDoc: no `size`/`color`, size is a class, colour is `currentColor`. |
| `packages/ui/src/components/icon/icon.const.ts` **(new)**       | `ICON_BASE_CLASS` (default size), `ICON_STROKE_WIDTH`, `ICON_VIEW_BOX`.                                   |
| `packages/ui/src/components/icon/icons.tsx` **(new)**           | `SunIcon`, `MoonIcon`, `SunsetIcon`, `SettingsIcon`, `ChevronRightIcon`.                                  |
| `packages/ui/src/index.ts`                                      | Explicit exports: 5 components + `IconProps` (no `export *`).                                             |
| `packages/ui/src/components/radio-group/radio-group.interface.ts` | `readonly icon?: ReactNode` on `RadioOption` + JSDoc (decoration only, name comes from `label`).       |
| `packages/ui/src/components/radio-group/RadioGroup.tsx`         | Conditional icon render inside the `<label>` (see D2), `aria-hidden` wrapper, no other DOM change.        |
| `packages/ui/test/mocks/icon-options.mock.tsx` **(new)**        | `ICON_RADIO_OPTIONS` fixture (3 options, one disabled) — tests must not declare fixtures inline.          |
| `packages/ui/test/icon.test.tsx` **(new)**                      | Attribute + class-merge tests for all five icons.                                                        |
| `packages/ui/test/radio-group.test.tsx`                         | Icon cases: icon rendered, click selects, checked switch, disabled not selectable, keyboard unchanged, accessible name = text only. |
| `packages/ui/test/form-a11y.test.tsx`                           | One `axe` case with `ICON_RADIO_OPTIONS` (image-role / aria-hidden regressions).                          |
| `docs/Specs/UI-Architecture.md`                                 | §4 `RadioGroup` row + new "Icon set" paragraph, §7 note that **no** row was added and why, header `Utolsó frissítés` date. |
| `docs/history/<YYYY-MM-DD--HH-ii-ss>-ais-144-icon-set.md` **(new)** | Post-implementation summary (repo rule). No milestone: the design decision is preserved in the spec, no bug and no cross-service risk. |

## SVG source (Lucide, ISC — 24×24, `fill="none"`, `stroke="currentColor"`, `strokeWidth={2}`)

| Icon               | Source                                                                  | Inner markup                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `SunIcon`          | https://lucide.dev/icons/sun                                            | `<circle cx="12" cy="12" r="4"/>` + 8 rays: `M12 2v2`, `M12 20v2`, `m4.93 4.93 1.41 1.41`, `m19.07 4.93-1.41 1.41`, `M2 12h2`, `M22 12h2`, `m6.34 17.66-1.41 1.41`, `m17.66 17.66 1.41 1.41` |
| `MoonIcon`         | https://lucide.dev/icons/moon                                           | `M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z`                                                                                            |
| `SunsetIcon`       | https://lucide.dev/icons/sunset                                         | `M12 10V2`, `m4.93 10.93 1.41 1.41`, `M2 18h2`, `M20 18h2`, `m19.07 10.93-1.41 1.41`, `M22 22H2`, `m16 6-4 4-4-4`, `M16 18a4 4 0 0 0-8 0` |
| `SettingsIcon`     | https://lucide.dev/icons/settings                                       | gear outline path (from the source) + `<circle cx="12" cy="12" r="3"/>`                                                          |
| `ChevronRightIcon` | https://lucide.dev/icons/chevron-right                                  | `m9 18 6-6-6-6`                                                                                                                  |

Copy the `SettingsIcon` gear path verbatim from the source URL — it is the only
multi-segment path and must not be retyped by hand.

## Steps

1. `icon.interface.ts` + `icon.const.ts` (props type, base class, shared constants).
2. `icons.tsx`: five components, shared attribute spread, `cn(ICON_BASE_CLASS, className)`, JSDoc with licence + source URL on each.
3. `packages/ui/src/index.ts`: explicit exports (components + `IconProps`).
4. `RadioOption.icon` in `radio-group.interface.ts` (`ReactNode`, JSDoc on the decorative contract).
5. `RadioGroup.tsx`: when `option.icon` is set, wrap icon + label text in `<span className="inline-flex items-center gap-2">`, icon in `<span aria-hidden="true" className="shrink-0">`; `description` stays a sibling `block` span. No icon → current markup untouched.
6. Test fixtures in `test/mocks/icon-options.mock.tsx`, then `test/icon.test.tsx` and the new `radio-group.test.tsx` cases; extend `form-a11y.test.tsx` with the icon variant.
7. `docs/Specs/UI-Architecture.md`: §4 `RadioGroup` row gains `icon?`; new paragraph after the primitives table documenting the icon set (no dependency, ISC, `currentColor` + tokens, decorative-only rule); §7 gets a short "AIS-144 added no dependency" note; header date bumped.
8. Run the verification block; write the `docs/history/` entry.

## Test matrix

| Case                                                        | Expectation                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Each of the 5 icons                                         | `aria-hidden="true"`, `focusable="false"`, `viewBox="0 0 24 24"`, `stroke="currentColor"`, `fill="none"` |
| `className` prop                                            | merged with the base class, caller class wins on conflicts          |
| `RadioGroup` without icons                                  | labels and DOM structure unchanged (existing suite stays green)     |
| `RadioGroup` with icons                                     | label contains icon + text; clicking the label selects the option   |
| `RadioGroup` with icons, `checked` switch                   | checked state follows `value`                                       |
| `RadioGroup` with icons, disabled option                    | icon rendered, option not selectable                                |
| Accessible name with icon                                   | exactly the label text (no double announcement); icon wrapper `aria-hidden` |
| Arrow keys with icons                                       | `nextOptionValue` behaviour unchanged                               |
| `axe` with `ICON_RADIO_OPTIONS`                             | zero violations                                                     |

## Verification

```powershell
pnpm --filter @callback/ui test
pnpm typecheck
pnpm lint
pnpm quality
```

`pnpm quality` must stay green in three gates: `quality:tokens` (no colour
literal — the SVGs use `currentColor` only), `quality:docs` (relative links +
`§N` references + the bumped header date), and `quality:dead-code`.

## Risks

- **Dead code (`knip`).** The five icons and `IconProps` are exported from
  `packages/ui/src/index.ts`, whose `exports` field is the workspace's knip
  entry, so entry exports are not reported and the icons are genuinely used by
  AIS-145 / AIS-147 later. If `quality:dead-code` turns red anyway, do **not**
  delete the exports — the fix is to make the first consumer land in the same
  change, and the ticket order (AIS-144 first) already guarantees that.
- **Unsized SVG (D1).** Without the base class the icon stretches to the
  container width; the test asserts the base class is present.
- **Description layout (D2).** A permanent flex wrapper would move the
  description inline; the conditional render keeps `<label>` a block container.
