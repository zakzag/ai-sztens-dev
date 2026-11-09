# Glass appearances — thicker, glossier frame

**Date:** 2026-11-08 02:10 (Europe/Budapest)
**Plan:** [`docs/plans/2026-11-08--02-10-00-glass-thicker-frame-and-sheen-plan.md`](../plans/2026-11-08--02-10-00-glass-thicker-frame-and-sheen-plan.md)
**Milestone:** [`docs/milestones/2026-11-08--02-10-00-glass-thicker-frame-and-sheen.milestone.md`](../milestones/2026-11-08--02-10-00-glass-thicker-frame-and-sheen.milestone.md)

## What changed

The four glass appearances now have a visibly thicker, brighter frame and a richer
catch-light, so they read as glass instead of as a tinted card.

- **Thickness is appearance state.** The glass blocks restate
  `--border-width-hairline/-default/-strong` as `2 / 2.5 / 3px`; `light`, `dark`
  and `ambient` keep the `1 / 1.5 / 2px` `:root` ladder. Because every primitive
  paints its outline through the `border-hairline` / `border-strong` utilities,
  one token change thickens cards, tables, buttons, inputs, badges, dialogs — no
  component knows about it.
- **Brighter rims.** Per-variant rim alphas rose by `0.04 – 0.08` (e.g. `glass`
  `0.30 / 0.40 → 0.34 / 0.44`, `glass-crystal` `0.48 / 0.55 → 0.55 / 0.62`), and
  the top bevel of `--shadow-neu-raised` got a brighter inner rim.
- **Richer sheen.** `--glass-sheen` is now two layered gradients: the wide 135°
  body streak plus a narrow 102° specular band (the "glint").
- **Gloss without blur.** New `@utility sheen-glass` (`SHEEN_GLASS_CLASS`) applies
  the sheen alone and is carried by [`Card`](../../packages/ui/src/components/card/Card.tsx:1)
  and the [`Table`](../../packages/ui/src/components/table/Table.tsx:1) shell.
  Blur stays reserved for the floating layers.

## Files

| File                                                                                               | Change                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/ui/src/styles/theme.css`](../../packages/ui/src/styles/theme.css)                       | `@utility sheen-glass`; glass family documented as a five-part contract; all four glass blocks get the `2 / 2.5 / 3px` frame ladder, brighter rims/bevels and the two-band sheen |
| [`packages/ui/src/theme/theme.const.ts`](../../packages/ui/src/theme/theme.const.ts)               | new `SHEEN_GLASS_CLASS` (single home of the class name, like `SURFACE_GLASS_CLASS`)                                                                                              |
| [`packages/ui/src/components/card/Card.tsx`](../../packages/ui/src/components/card/Card.tsx)       | card carries `sheen-glass` (gloss, no filter)                                                                                                                                    |
| [`packages/ui/src/components/table/Table.tsx`](../../packages/ui/src/components/table/Table.tsx)   | table shell carries `sheen-glass`                                                                                                                                                |
| [`scripts/quality/theme-tokens.const.mjs`](../../scripts/quality/theme-tokens.const.mjs)           | `--border-width-*` added to `THEME_STATE_TOKENS` (width is appearance state)                                                                                                     |
| [`scripts/quality/theme-tokens.logic.test.mjs`](../../scripts/quality/theme-tokens.logic.test.mjs) | new case: a translucent appearance may restate the frame ladder                                                                                                                  |
| [`packages/ui/test/surface-glass.test.tsx`](../../packages/ui/test/surface-glass.test.tsx)         | three `sheen-glass` assertions (single spelling, card, table)                                                                                                                    |
| [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md)                                     | §3.2 thickness-is-state note, §3.2.2 state-token table, glass variant table (rim values + 2px frame), five-part contract                                                         |
| [`.roo/rules/react.coding-standards.md`](../../.roo/rules/react.coding-standards.md)               | appearance row mentions `sheen-glass`; glass recipe table gains the "Glossy shell" row and the thickness note                                                                    |

## Gates

- `pnpm quality:themes` — 0 violations.
- `node --test scripts/quality/theme-tokens.logic.test.mjs` — 15 pass.
- `pnpm --filter @callback/ui exec vitest run test/surface-glass.test.tsx test/card.test.tsx test/table.test.tsx test/data-table.test.tsx` — 30 pass.
- `pnpm quality:docs` — 0 violations.
