# Milestone — four glassmorphism variants (AIS-169)

**Date:** 2026-11-08 · **Ticket:** AIS-169 (follow-up of AIS-164) · **Area:** `packages/ui/src/styles/theme.css` + admin appearance selector

## Problem

The first glass appearance (AIS-166) was a cautious compromise: 35–45% alpha surfaces, dark-ish
rims and a single neomorphic shadow replaced by a soft drop. Against the reference the user supplied
(pale glass panes over a soft blue-grey backdrop, pill radii, a thin bright rim) it read as *smoked
plastic*, not glass. The product decision — **which** glass look to ship — cannot be made from a
description, so the four candidate readings were shipped as selectable appearances.

## Design rationale

| Mechanism | Value | Why |
| --------- | ----- | --- |
| Fill | white at **5–24%** alpha (55–60% dark for smoke) | the backdrop must show through; a 35%+ fill is a grey card |
| Rim | borders white at **22–65%** | the catch-light edge does more for the illusion than any shadow |
| Bevel | `inset 0 1px 0` bright + `inset 0 -1px 0` dark, in the depth slots | that pair reads as *thickness*; a uniform border alone reads flat |
| Lift | one large, low-alpha drop shadow (12–26px blur band) | depth without a visible "drop shadow" |
| Sheen | `--glass-sheen`, a 135° specular gradient applied as `background-image` by `surface-glass` | the streak a border cannot produce; `background-image` stacks over `bg-surface-*` instead of replacing it |
| Saturate | 120–155% next to the blur | a blur averages pixels and drains chroma — this is the "milky plastic" bug |
| Blur radius | 12–26px, never >30px | past ~30px the backdrop stops reading as shapes and turns to fog |

Two constraints shaped the implementation: `backdrop-filter` and gradients are **properties**, not
token values, so they live in the single `@utility surface-glass` (a no-op outside the family because
`--blur-glass` is `0px`); and text sits on the *composited* surface, so each variant's base lightness
plus fill alpha has to keep `text-text-primary` above 4.5:1.

## Implementation

| File | Change |
| ---- | ------ |
| `packages/ui/src/styles/theme.css` | `--glass-sheen` state token; `surface-glass` gains `background-image`; `glass` retuned; new `glass-frost`, `glass-crystal`, `glass-smoke` blocks; both readability fallbacks cover all four |
| `packages/ui/src/theme/theme.interface.ts`, `theme.const.ts` | union and `THEME_NAMES` grow to seven |
| `packages/ui/src/components/icon/icons.tsx`, `src/index.ts` | `SnowflakeIcon`, `DropletIcon`, `CloudIcon` (Lucide, ISC, no dependency) |
| `apps/admin/src/app/layout/layout.const.ts` | three values, labels (`Fagyott üveg`, `Kristályüveg`, `Füstüveg`), icons, seven-entry option list |
| `apps/admin/index.html` | boot script accepts all seven names |
| tests (`theme-selector.logic`, `ThemeSelector`, `theme.logic`, `icon`) | seven options, seven names, three new icons |
| `scripts/quality/theme-tokens.const.mjs` | `--glass-sheen` added to the allowed state tokens |

## Outcome and verification

Seven appearances in the header selector; picking any of them repaints the whole UI immediately,
survives a reload, and produces no flash on load.

```bash
pnpm quality          # quality:themes compares all seven blocks against the @theme set
pnpm build            # dist CSS 44.5 kB, all seven :root[data-theme=…] blocks present
pnpm --filter @callback/admin test
pnpm --filter @callback/ui test
```

Manual: `pnpm dev` → `/api-keys` → `Megjelenés` → compare the four glass entries; setting the OS
`prefers-reduced-transparency: reduce` makes all four opaque.

## Follow-ups

- Once a variant is chosen, the other three are deleted (one token block + three options); the
  `theme-tokens` gate and the selector test fail immediately on a half-removed variant.
- Border gradients (a true directional rim rather than a uniform border + inset bevel) would need a
  pseudo-element or `border-image`; not needed for the current look.
- Glass on glass is still avoided by design: nested translucent panels would stack blurs.
