# Admin retheme + dark borders for every component

**Date:** 2026-10-22 02:51 (Europe/Budapest)
**Scope:** [`packages/ui/src/styles/theme.css`](../../packages/ui/src/styles/theme.css:1),
[`packages/ui/src/components`](../../packages/ui/src/components/card/Card.tsx:1),
`packages/ui/test/*.test.tsx`,
[`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1)

## What was asked

1. Change the theme of the admin app.
2. Change the border colour of **all** components to a dark one — "not whitish".

## What was wrong

The components did set a border **width** (`border border-hairline`) but never a border
**colour**. Tailwind v4 preflight declares `border: 0 solid` with no colour, so
`border-color` resolved to `currentColor` — i.e. the near-white `--color-text-primary`
token. Every card, table, badge, input, textarea and button therefore had a light,
whitish outline on a dark surface.

## What changed

| File | Change |
|---|---|
| [`theme.css`](../../packages/ui/src/styles/theme.css:1) | New admin palette: graphite/ash surfaces (`L≈0.135–0.255`, hue `250`, chroma `≤0.01`) and a teal-cyan accent (`195°`). Dark border ladder `0.30 / 0.36 / 0.45`, teal focus ring. Neomorphic shadows rebuilt on dark values (no near-white highlight). Added `@layer base` reset `border-color: var(--color-border-hairline)` plus `::selection` / `:focus-visible` accents. |
| [`button.variants.ts`](../../packages/ui/src/components/button/button.variants.ts:8) | Base recipe gains `border-border-hairline`. |
| [`badge.variants.ts`](../../packages/ui/src/components/badge/badge.variants.ts:8) | Base recipe gains `border-border-hairline`. |
| [`input.variants.ts`](../../packages/ui/src/components/input/input.variants.ts:8) | Resting outline `border-border-hairline`; `invalid` still overrides with `border-danger`. |
| [`textarea.variants.ts`](../../packages/ui/src/components/textarea/textarea.variants.ts:10) | Same as input. |
| [`Card.tsx`](../../packages/ui/src/components/card/Card.tsx:15) | Explicit `border-border-hairline` on the raised surface. |
| [`Table.tsx`](../../packages/ui/src/components/table/Table.tsx:12) | Explicit `border-border-hairline` on the scroll container. |
| `packages/ui/test/{card,badge,button,input,textarea,table}.test.tsx` | New assertion per primitive: outline carries `border-border-hairline` and no `border-current`. |

Token **names** were left untouched, so no page markup had to change: the admin app
inherits the new look purely from `theme.css`.

## Notes

- `Button`'s loading spinner keeps `border-current` on purpose — it is a spinner, not an
  outline, and must follow the label colour.
- `Alert` keeps its semantic `border-info/success/warning/danger` accent (2px `border-strong`).
- The public `apps/web` site is untouched; it does not import the token file yet.
