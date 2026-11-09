# Icon vocabulary without an icon library (AIS-144)

## Problem / feature

The admin header redesign (AIS-140) needs icons: three theme options
(Light / Dark / Ambient), a user-settings button and a breadcrumb separator.
The repo has **no icon dependency**, and two existing primitives provably
cannot host an icon:

- `SelectOption.label: string` → a native `<option>` cannot hold an SVG
  cross-browser, so the theme picker cannot be a `Select`.
- `RadioOption` had only `label`/`description`, so a `RadioGroup` label could
  not show anything but text.

AIS-144 therefore delivers the **icon vocabulary** and the `RadioOption.icon`
support, not the header.

## Design rationale

| Option                                        | Verdict                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Add `lucide-react` (or similar)               | Rejected. Five icons are ~1 kB of JSX; the package is larger than the payload, ships its own `size`/`color` props next to our tokens, and adds a supply-chain surface for geometry we can copy once. |
| Generic `<Icon name="sun" />` registry        | Rejected. A string registry loses tree-shaking of the unused glyphs and hides the props type behind a union.                                      |
| One component per icon, shared geometry props | **Chosen.** Explicit exports from `packages/ui/src/index.ts`, one `ICON_BASE_PROPS` object, one const file, no dynamic lookup.                    |

Sizing: `IconProps` exposes only `className`, but every icon carries a merged
`h-4 w-4 shrink-0` base class. An SVG with only a `viewBox` has no intrinsic
size and stretches to its container, so "the caller sizes it" cannot be the
only rule; `cn()` lets the caller override with `h-6 w-6` anyway.

Accessibility: icons are decoration, never content. Each SVG is
`aria-hidden="true"` + `focusable="false"` with `stroke="currentColor"`, so it
inherits the surrounding text token and cannot introduce a colour literal.
`RadioGroup` wraps it in an `aria-hidden` span and renders the wrapper **only
when** `option.icon` is set — that keeps the no-icon DOM byte-identical and
leaves `description` as its own block line instead of a flex sibling.

## Implementation

| File                                                              | Change                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/ui/src/components/icon/icon.interface.ts`               | `IconProps { className?: string }`, no `size`/`color`.             |
| `packages/ui/src/components/icon/icon.const.ts`                   | `ICON_BASE_CLASS`, `ICON_STROKE_WIDTH`, `ICON_VIEW_BOX`.           |
| `packages/ui/src/components/icon/icons.tsx`                       | `SunIcon`, `MoonIcon`, `SunsetIcon`, `SettingsIcon`, `ChevronRightIcon`. |
| `packages/ui/src/index.ts`                                        | Explicit exports (components + `IconProps`).                       |
| `packages/ui/src/components/radio-group/radio-group.interface.ts` | `RadioOption.icon?: ReactNode`.                                    |
| `packages/ui/src/components/radio-group/RadioGroup.tsx`           | Conditional icon + `aria-hidden` wrapper.                          |
| `packages/ui/test/{icon,radio-group,form-a11y}.test.tsx`          | Attribute contract, eight icon cases, one axe case.                |
| `packages/ui/test/mocks/icon-options.mock.tsx`                    | Icon radio fixtures.                                               |

Geometry is copied from Lucide (ISC); the licence and the source URL live in
each component's JSDoc. `packages/ui/package.json` is unchanged.

## Outcome and how to verify

```powershell
pnpm --filter @callback/ui test   # 42 files, 365 tests
pnpm typecheck ; pnpm lint
pnpm quality                      # knip: no issues, 0 token/docs violations
```

Manual check: render a `RadioGroup` with `ICON_RADIO_OPTIONS`; each option shows
the icon left of its text, a screen reader announces only the label text, and
the exported icons take a `className` size override.

## Follow-ups

- AIS-145 (`Breadcrumb`) consumes `ChevronRightIcon`; AIS-147 builds the header
  theme picker from `SunIcon` / `MoonIcon` / `SunsetIcon` / `SettingsIcon`.
- If the icon count ever grows past a couple of dozen, revisit a package — the
  hand-embedded approach is a decision for five icons, not a permanent ban.
