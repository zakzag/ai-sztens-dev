# Milestone — glass frame thickness and gloss

**Date:** 2026-11-08 02:10 (Europe/Budapest)
**Plan:** [`docs/plans/2026-11-08--02-10-00-glass-thicker-frame-and-sheen-plan.md`](../plans/2026-11-08--02-10-00-glass-thicker-frame-and-sheen-plan.md)

## Problem / feature

The four glass appearances looked flat on the running admin UI. The operator asked
for a thicker, shinier frame — "like glass". Two independent causes:

1. border **thickness** was a single global ladder (`1 / 1.5 / 2px`) that no
   appearance could change, so a glass rim was exactly as thin as a dark divider;
2. the only gloss carrier was `@utility surface-glass`, which bundles the blur and
   the sheen — and blur is deliberately banned on cards and table shells.

## Measured evidence

| Property                            | Opaque appearances       | Glass family (before)                  |
| ----------------------------------- | ------------------------ | -------------------------------------- |
| `--border-width-hairline`           | `1px`                    | `1px` (inherited)                      |
| rim alphas                          | dark greys `0.30 – 0.45` | white `0.22 – 0.65`                    |
| `--glass-sheen`                     | `none`                   | one 135° gradient, `0.08 – 0.26` alpha |
| `surface-glass` on `Card` / `Table` | absent                   | absent (by design)                     |

So on a page built from cards and tables — i.e. most of the admin — the glass
appearances differed from `dark` only by fill alpha.

## Root cause / design rationale

Thickness and gloss are _appearance state_, but the token file had no expression
for either: `--border-width-*` lived only in plain `:root` (never restated by a
theme), and the sheen was welded to the blur utility. The fix therefore had to
split both concepts, not tune numbers in a component:

| Decision                                                                                 | Rationale                                                                                                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Glass restates `--border-width-*` as `2 / 2.5 / 3px`; opaque themes keep `1 / 1.5 / 2px` | every primitive paints its outline through `border-hairline` / `border-strong`, so one token change thickens the whole UI without a `[data-theme]` branch anywhere |
| The three width names join `THEME_STATE_TOKENS` in the appearance gate                   | width is not a Tailwind namespace, so the gate would otherwise report it as an invented token. Allowed, not required — omitting them simply inherits the ladder    |
| Rim alphas raised `+0.04 … +0.08`, bevel inner rim brightened                            | width alone reads as a shadow, brightness alone as a hairline; both together read as a pane edge                                                                   |
| `--glass-sheen` becomes two layered gradients (wide 135° body + narrow 102° glint)       | one wide gradient tints; the narrow band is what the eye reads as a reflection                                                                                     |
| New `@utility sheen-glass` (`SHEEN_GLASS_CLASS`) on `Card` and the `Table` shell         | separates gloss from filter: the gradient is a paint, the blur stays on the floating layers where the frame-cost budget allows it                                  |
| Readability fallbacks untouched                                                          | `prefers-reduced-transparency` / `prefers-contrast` are about transparency and legibility; a thick rim does not harm either                                        |

## Solution / implementation

| File                                          | Change                                                                                                                                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/styles/theme.css`            | `@utility sheen-glass`; glass family documented as a **five**-part contract (fill, rim, bevel, sheen, thick frame); each of the four glass blocks gets the `2 / 2.5 / 3px` ladder, brighter rim/bevel alphas and the two-band sheen |
| `packages/ui/src/theme/theme.const.ts`        | `SHEEN_GLASS_CLASS` — single home of the utility name, mirroring `SURFACE_GLASS_CLASS`                                                                                                                                              |
| `packages/ui/src/components/card/Card.tsx`    | carries `sheen-glass` (gloss, no `backdrop-filter`)                                                                                                                                                                                 |
| `packages/ui/src/components/table/Table.tsx`  | table shell carries `sheen-glass`                                                                                                                                                                                                   |
| `scripts/quality/theme-tokens.const.mjs`      | `--border-width-hairline/-default/-strong` added to `THEME_STATE_TOKENS`                                                                                                                                                            |
| `scripts/quality/theme-tokens.logic.test.mjs` | case: a translucent appearance may restate the frame ladder                                                                                                                                                                         |
| `packages/ui/test/surface-glass.test.tsx`     | pins one spelling of `sheen-glass`, the card gloss, the table gloss, and that the card still has no blur class                                                                                                                      |
| `docs/Specs/UI-Architecture.md`               | §3.2 "thickness is appearance state", §3.2.2 state-token table + `sheen-glass`, variant table with new rim values, five-part contract                                                                                               |
| `.roo/rules/react.coding-standards.md`        | appearance row and glass recipe table (new "Glossy shell" row, thickness note)                                                                                                                                                      |

## Outcome and how to verify

Glass appearances now show a frame roughly twice as thick as the opaque ones, a
brighter rim, and a diagonal glint on cards and tables as well as on overlays.
Opaque appearances are byte-for-byte unchanged.

```bash
pnpm quality:themes                                        # appearance-token gate
node --test scripts/quality/theme-tokens.logic.test.mjs     # gate logic, incl. the new case
pnpm --filter @callback/ui test                            # primitives + sheen glass tests
pnpm --filter @callback/admin dev:dev                      # manual check
```

Manual check: header selector → `Üveg`, `Fagyott üveg`, `Kristályüveg`, `Füstüveg`.
Each should show a clearly thicker, brighter card/table rim with a diagonal
highlight; `Sötét` / `Világos` / `Ambiente` must look exactly as before.

## Follow-ups

- The admin header's two dividers use `border-b` / `border-t` **without** the
  `border-hairline` utility, so they stay 1px in the glass family. That is
  intentional (a divider is not a frame), but it means the header edge is thinner
  than the panels below it — revisit only if it reads as a mismatch.
- `--border-width-default` is still unused by any utility; it is kept in the
  contract so the ladder stays complete.
- A slow, animated glint was considered and dropped: motion on a full-page surface,
  and unverifiable in jsdom.
