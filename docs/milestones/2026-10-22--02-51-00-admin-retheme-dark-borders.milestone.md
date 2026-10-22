# Admin retheme and the whitish-outline defect

**Date:** 2026-10-22 · **Area:** `packages/ui` design tokens + primitives

## 1. Problem

The admin SPA showed every component — cards, tables, badges, inputs, textareas,
buttons — with a **light, whitish outline** on a dark background, and the overall palette
(violet on blue-graphite) no longer matched the admin's intended identity. Two requests:
retheme the admin app, and make every component border dark.

## 2. Evidence

Primitives contained width-only border utilities:

```text
Card.tsx             'rounded-card border border-hairline bg-surface-raised ...'
Table.tsx            '... border border-hairline bg-surface-raised ...'
badge.variants.ts    '... rounded-pill border border-hairline px-2.5 ...'
button.variants.ts   '... rounded-control border border-hairline font-medium ...'
```

Tailwind v4 preflight emits `border: 0 solid` (no colour), so `border-color` fell back to
`currentColor`. With `--color-text-primary: oklch(0.97 …)` the outline rendered ~97 %
lightness — the reported whitish ring. `--color-border-hairline` existed but was only
reachable through an explicit `border-border-hairline`, which none of the primitives used.

## 3. Root cause / rationale

Choosing *width* tokens without a *colour* token in the recipe is the bug; the palette
itself (`0.33` lightness hairline) was already dark. Fixing only the tokens would not have
helped. Alternatives considered:

- **Per-component colour only** — works, but any future `border`/`border-b` in app code
  reintroduces `currentColor`.
- **Base reset only** — works, but silently depends on cascade layers and breaks if the
  theme file is dropped or preflight ordering changes.
- **Both (chosen)** — base reset for a safe default plus explicit colour in every
  primitive, so the intent is visible in the recipe as well.

## 4. Implementation

| File | Change |
|---|---|
| `packages/ui/src/styles/theme.css` | New graphite/ash surfaces (`L 0.135–0.255`, hue 250, chroma ≤0.01), teal accent (`195°`), dark border ladder `0.30 / 0.36 / 0.45`, teal focus ring, dark neomorphic shadows. `@layer base` sets `border-color: var(--color-border-hairline)` on `*, ::before, ::after, ::backdrop, ::file-selector-button`; adds `::selection` and `:focus-visible` accents. |
| `packages/ui/src/components/button/button.variants.ts` | `border-border-hairline` in the base recipe. |
| `packages/ui/src/components/badge/badge.variants.ts` | `border-border-hairline` in the base recipe. |
| `packages/ui/src/components/input/input.variants.ts` | `border-border-hairline` resting outline. |
| `packages/ui/src/components/textarea/textarea.variants.ts` | `border-border-hairline` resting outline. |
| `packages/ui/src/components/card/Card.tsx` | Explicit dark outline. |
| `packages/ui/src/components/table/Table.tsx` | Explicit dark outline on the scroll container. |
| `packages/ui/test/{card,badge,button,input,textarea,table}.test.tsx` | Assert `border-border-hairline` present and `border-current` absent. |
| `docs/Specs/UI-Architecture.md` | §3.1 theme identity, §3.2.1 decision **D40** (default border colour). |

Token names are unchanged, so no page or feature code changed. `Alert` keeps its semantic
`border-{info,success,warning,danger}` accent; the `Button` loading spinner keeps
`border-current` deliberately.

## 5. Outcome and verification

A `border` utility without a colour token now renders dark grey; components name their
outline explicitly. Verify with:

```bash
pnpm --filter @callback/ui test
pnpm --filter @callback/admin test
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build
pnpm --filter @callback/admin dev      # visual check: /api-keys, /login
```

Grep guards (must print nothing):

```bash
rg "border-current" packages/ui/src/components --glob '!*button*'
rg "#[0-9a-fA-F]{3,8}" apps/admin/src
```

## 6. Follow-ups

- `apps/web` still uses its own `bg-slate-950` stylesheet and will need the same token
  migration (and therefore its own accent decision) before it shares this theme.
- `--color-border-default` is currently unused; either adopt it for dividers or drop it in
  a later token cleanup.
