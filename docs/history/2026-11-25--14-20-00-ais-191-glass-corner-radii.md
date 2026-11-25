# AIS-191 — the glass family gets its own corner ladder

**Date:** 2026-11-25
**Ticket:** [AIS-191](https://zakzag.atlassian.net/browse/AIS-191) — `UI - impl: a glass témák egységes lekerekítése — input 0.25rem, panel/ablak 0.33rem` (parent epic AIS-137 `UI Design`)
**Implementation guide:** the ticket's comment (`10835`)

## What changed

The four glass appearances now share one, sharper geometry — `--radius-control: 0.25rem` for everything
you type into or click, `--radius-card: 0.33rem` for everything that floats or holds content — while
`dark`, `light` and `ambient` keep the softer `0.625rem / 1rem` they had. Shape therefore behaves exactly
like the border-width ladder: a trait the glass family states for itself.

| Block | `--radius-control` | `--radius-card` |
| --- | --- | --- |
| `@theme` (dark), `light`, `ambient` | 0.625rem (unchanged) | 1rem (unchanged) |
| `glass` | 0.875rem → **0.25rem** | `.33rem` → **0.33rem** |
| `glass-frost` | 1rem → **0.25rem** | 1.75rem → **0.33rem** |
| `glass-crystal` | 1rem → **0.25rem** | 1.5rem → **0.33rem** |
| `glass-smoke` | 0.875rem → **0.25rem** | 1.5rem → **0.33rem** |

The `glass` block's `0.33rem` came from `091c892`; this change extends it to the rest of the family and
normalises the writing (`0.33rem`, not `.33rem`). The `glass-frost` comment
`/* Shape — the roundest of the family */` was replaced by `/* Shape — glass pane geometry … */`, because
all four members now share the same corner and the “roundest” claim had become false.

## Files

| File | Change |
| --- | --- |
| `packages/ui/src/styles/theme.css` | 8 values in the 4 glass blocks + one comment per glass block; the three opaque blocks untouched |
| `packages/ui/src/components/tooltip/tooltip.variants.ts` | `rounded-control` → `rounded-card` (a tooltip is a surface) |
| `packages/ui/src/components/dropdown-menu/dropdown-menu.variants.ts` | popover content → `rounded-card`; items stay controls |
| `packages/ui/src/components/combobox/Combobox.tsx` | the listbox → `rounded-card`; option rows stay controls |
| `packages/ui/src/components/log-drawer/log-drawer.variants.ts` | the pretty-printed JSON block → `rounded-card` |
| `.roo/rules/react.coding-standards.md` §7 | Shape row carries the two values; the frosted-popover recipe moves to `rounded-card`; a new paragraph documents the glass corner ladder and the surface/control rule |
| `docs/Specs/UI-Architecture.md` §3.2 + §3.3 + header | the corner ladder next to the thickness ladder; a new non-negotiable rule (6) for surface vs. control |

The four reclassifications are **semantic**: the gap between `0.25rem` and `0.33rem` is ~1px, so they
barely move a pixel — they exist so the two tokens keep meaning the same thing when a future appearance
pulls them apart again.

## Why the gate stays green without a config change

`pnpm quality:themes` compares token **names** per appearance block, not values: every block still
declares both radius tokens, only the glass values differ. `THEME_STATE_TOKENS` was deliberately **not**
extended — that list holds `:root`-only tokens that are absent from `@theme` (the three border widths,
`--blur-glass`, …), while the radius tokens live in `@theme` and are therefore mandatory everywhere.

## Verification

```text
pnpm quality                -> layers, knip, palette, themes, field-errors, docs: 0 violations
pnpm --filter @callback/ui test -> 49 files, 519 tests passed
git diff --stat             -> 7 files; theme.css touches only the 4 glass blocks
```

Manual check owed by the reviewer: switch through `light` / `dark` / `ambient` (must look unchanged) and
the four glass appearances (identical corners: input 0.25rem, panel 0.33rem, dialog 0.33rem with 0.25rem
inputs inside, tooltip/dropdown/combobox/toast 0.33rem).

## Follow-ups

- The generated agent instruction files (`.claude`, `.cursor`, `.github`) are rendered from
  `.roo/rules/*.md`; run `scripts/init.ps1` / `scripts/init.sh` if they should be refreshed in the same
  branch.
- The opaque appearances keep `0.625rem / 1rem`. If they should ever follow the glass ladder, that is a
  separate ticket — the two token values are now a one-line change per block.
- `--radius-pill` (Badge) and the `Button` spinner's `rounded-full` are intentionally outside the rule.
