# Milestone — theme engine and the glass appearance (AIS-164)

**Date:** 2026-11-08 · **Tickets:** AIS-164 (AIS-165, AIS-166, AIS-167, AIS-168) · **Area:** `packages/ui` tokens + `apps/admin` shell

## Problem

The admin header had an appearance selector (`light` / `dark` / `ambient`) that changed **nothing**:
the choice lived in a local `useState`, `onThemeChange` was a documented no-op and `theme.css` held a
single dark token set with `color-scheme: dark` hard-coded. A fourth, glassmorphism appearance could
not be "added next to the three" — the mechanism that makes *any* appearance real did not exist.

## Measured evidence

| Fact | Value |
| ---- | ----- |
| Token utilities in recipes | 107 occurrences in 22 files |
| `toHaveClass` assertions in the whole test suite | 5 |
| Files containing surface/depth recipes | 22 (0 needed rewriting) |
| Existing `data-theme` writes before the change | none |
| Admin tests before / after | 537 → 541 |
| UI tests before / after | 499 → 501 |

The first two numbers are the whole cost argument: because every recipe consumes tokens through CSS
variables, re-valuing a token restyles the entire UI. Only the *blur affordance* genuinely required
new component code.

## Design rationale

| Decision | Why |
| -------- | --- |
| `@theme` stays the dark default; appearances are `:root[data-theme="…"]` blocks | zero regression, `apps/web` unchanged, specificity (0,2,0 > 0,1,0) decides |
| Appearance-state tokens (`--color-scheme`, `--app-backdrop`, `--blur-glass`, `--saturate-glass`) live in plain `:root` | `--color-*` is Tailwind's colour namespace; `--color-scheme` there would become a colour named "scheme" |
| `backdrop-filter` is a `@utility surface-glass` applied unconditionally to floating layers | it is a property, not a value, so a theme block cannot switch it; over an opaque surface it is a no-op |
| Blur only on overlays, never on cards or table rows | one `backdrop-filter` per scrolling row is the known frame-cost worst case |
| The selector stays a **controlled** control; `AdminLayout` owns the wiring | the "no side effects" invariant stays provable on the component, and the document/persistence assertion lives in one place |
| Theme state is a `useState` in a provider, not a store | it is document state mirrored into `localStorage`; AIS-140 `D11` forbids a third global store |
| A `quality:themes` gate compares token **names** per block | a theme that forgets a colour silently inherits dark — the failure mode is invisible at runtime |

## Implementation

| File | Change |
| ---- | ------ |
| `packages/ui/src/theme/theme.interface.ts`, `theme.const.ts` | `ThemeName` union (`light`, `dark`, `ambient`, `glass`), `THEME_NAMES`, `DEFAULT_THEME_NAME`, `SURFACE_GLASS_CLASS` |
| `packages/ui/src/styles/theme.css` | appearance-state tokens, `@utility surface-glass`, `light` / `ambient` / `glass` blocks, body backdrop, reduced-transparency + contrast fallbacks |
| 9 overlay recipes + `Combobox.tsx` | carry `surface-glass` (dialog, drawer, dropdown/select, tooltip, toast, banner, log drawer panel + handle, combobox listbox) |
| `apps/admin/src/app/theme/*` | `theme.const.ts` (attribute, storage key), pure `theme.logic.ts`, `theme-provider.tsx`, `use-theme.ts`, `theme.errors.ts`, interfaces |
| `apps/admin/index.html` | inline boot script sets `data-theme` before the bundle (no flash) |
| `apps/admin/src/app/layout/*` | fourth `Üveg` option + `LayersIcon`, `ThemeOption = ThemeName`, controlled selector, provider wiring in `AdminLayout` |
| `scripts/quality/theme-tokens.*` + `fixtures/theme/` | the gate, its fixtures and its tests; `pnpm quality:themes` added to `pnpm quality` |
| `docs/Specs/UI-Architecture.md`, `.roo/rules/react.coding-standards.md` | token tables, appearance rules, gate documentation |

## Outcome and verification

Four appearances work, persist across reloads and never flash: `light`, `dark` (byte-identical to
before), `ambient` (warm dusk with a two-source glow) and `glass` (translucent panels, light rims,
soft depth, backdrop blur on floating layers only).

```bash
pnpm quality            # includes the new quality:themes gate
pnpm quality:themes     # empty output = every appearance declares the full token set
pnpm --filter @callback/admin test
pnpm --filter @callback/ui test
```

Manual: `pnpm dev` → `/api-keys` → open the appearance select, pick `Üveg`; the whole UI frosts
immediately, survives a reload, and the OS setting `prefers-reduced-transparency: reduce` turns it
back into opaque surfaces.

## Follow-ups

- `--shadow-neu-*` names are theme-neutral in intent but still say "neu"; a rename touches 26 files
  and zero behaviour.
- No selector for `apps/web` (it keeps the default appearance by having no attribute).
- `pnpm test:quality` cannot expand its glob on Node 20 (repo `engines` is ≥24.9.0); run the gate
  tests file-by-file on older runtimes.
