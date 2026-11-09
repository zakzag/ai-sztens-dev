# Glassmorphism as a fourth appearance — feasibility and cost

**Created:** 2026-11-08 00:18 (Europe/Budapest)
**Ticket:** none (assessment; the theming story is AIS-140 `D3`)
**Scope:** `packages/ui/src/styles/theme.css`, overlay primitives in `packages/ui`, `apps/admin/src/app/layout/*`
**Status:** assessment only — no code changed

---

## 1. Question

How expensive is it to restyle the whole UI to glassmorphism (translucent panels, blur behind
them, glass buttons, smooth non-pixel borders) and ship it as a fourth appearance next to
`light`, `dark` and `ambient`?

## 2. Measured state of the codebase

| Fact | Evidence |
| ---- | -------- |
| One token file owns every colour, depth, radius and duration | [`theme.css`](../../packages/ui/src/styles/theme.css:22) — ~30 colour tokens, 4 `--shadow-*`, 3 `--radius-*`, 2 durations |
| Both apps import exactly that file after Tailwind | [`apps/admin/src/index.css`](../../apps/admin/src/index.css:11), `apps/web/src/index.css` |
| Utilities consume the tokens through CSS variables | every recipe uses `bg-surface-raised`, `border-border-hairline`, `shadow-neu-raised`, … (Tailwind v4 emits `var(--…)`) |
| Blast radius of a token revaluation | **22 files** hold surface/depth recipes, **107** token-utility occurrences, only **5** `toHaveClass` assertions in tests |
| **No theme mechanism exists** | `data-theme` is never set: [`theme-selector.interface.ts:9`](../../apps/admin/src/app/layout/theme-selector.interface.ts:9) is a choice type, `onThemeChange` is a documented no-op ([`AdminLayout.tsx:12`](../../apps/admin/src/app/layout/AdminLayout.tsx:12)), `color-scheme: dark` is hard-coded in the `@layer base` block of [`theme.css:128`](../../packages/ui/src/styles/theme.css:128) |
| Colour literals are legal in **one** file only | [`palette-gate.const.mjs:35`](../../scripts/quality/palette-gate.const.mjs:35) |

Consequence: `light` / `dark` / `ambient` are **labels today**, not implementations. The fourth
appearance cannot be "inserted after them" — the engine they all need does not exist yet.

## 3. What glassmorphism actually needs

| Requirement | Expressible by tokens alone? | Where the work lands |
| ----------- | --------------------------- | -------------------- |
| Translucent surfaces (`oklch(... / 0.5)`) | yes | `theme.css` only |
| Smooth rims (1px translucent light border, larger radii) | yes | `theme.css` only |
| Depth: soft outer shadow + inner light rim instead of neomorphic dual shadow | yes (`--shadow-*` values) | `theme.css` only |
| Something colourful behind the glass (needed, or the blur is invisible) | yes — a body-level gradient via a `--app-backdrop` token consumed in `@layer base` | `theme.css` only |
| **`backdrop-filter: blur()`** | **no** — it is a utility/property, not a value token | overlay recipes: `dialog`, `drawer`, `dropdown-menu`, `tooltip`, `toast`, `banner`, `log-drawer`, `combobox` listbox, `select-menu` panel (~10 files) |
| Readability over blur (per-theme text/border contrast) | yes | `theme.css` only |
| `prefers-reduced-transparency` / `prefers-contrast` fallback | yes, but must be written | `theme.css` |
| `color-scheme` per theme | partially — the hard-coded `dark` must become `color-scheme: var(--color-scheme)` | `theme.css` base layer |

Two implementation options for the blur:

1. **New `@utility surface-glass`** applied in the ~10 overlay recipes. Honest, tokenised,
   reversible, dies with the theme is off (opaque token + `backdrop-filter` is a no-op visually
   when the surface is opaque). **Recommended.**
2. A `[data-theme="glass"] .bg-surface-overlay { backdrop-filter: … }` rule. Zero component edits,
   but it targets a utility class name, duplicates the recipe list, and silently misses every
   future overlay. Rejected.

## 4. Cost estimate

| Phase | Work | Size |
| ----- | ---- | ---- |
| A — theme engine (precondition, AIS-140 `D3`) | `data-theme` on `<html>`, three token blocks, persistence + flash-free boot (inline script), selector wiring, session/UI store decision, tests | **largest single item** (~1–2 days) |
| B — glass token block | one `[data-theme="glass"]` block: colours with alpha, light rims, radii, shadows, body backdrop, `color-scheme` | hours, **1 file** |
| C — glass affordance | `@utility surface-glass` + apply in ~10 overlay/panel recipes, one test per primitive | ~0.5 day |
| D — docs/gates | `UI-Architecture.md` §3.3 + §7 token tables, palette-gate note, new appearance row in `.roo/rules/react.coding-standards.md` §7, milestone | hours |

Glass **on top of an existing engine**: ~1 day. Glass **including** the engine: ~2–3 days.
The 22 recipe files and 107 utilities are *not* the cost — the tokens absorb them.

## 5. Risks to decide up front

- **Blur + scroll performance.** `backdrop-filter` on a scrolling data table is the known
  worst case; blur must stay on overlay layers only, never on table rows.
- **Nested glass** (dialog over card over body gradient) loses contrast quickly; needs a
  documented stacking of surface tokens, not free-form alpha.
- **WCAG AA** must be re-verified per theme for `text-text-*` on translucent surfaces.
- **Naming debt.** `--shadow-neu-*` names are neomorphic; in a glass theme they are misleading.
  Either keep the names as generic depth tokens (0 extra work) or rename them (26 files).
- **`apps/web`.** It consumes the same token file; because the theme is driven by a `<html>`
  attribute and the marketing site has no selector, it stays on the default appearance. Intentional
  and free.
- **Gates.** Colour literals are allowed only in `theme.css` (palette gate), a new unused
  utility fails `quality:dead-code`, and `quality:docs` requires the spec update in the same change.

## 6. Out of scope

Theme engine implementation, light/ambient token sets, persistence design, header redesign
changes beyond a fourth option entry.
