# Glass family gets a photographic backdrop

**Date:** 2026-11-08 13:15
**Scope:** `packages/ui/src/styles/theme.css`, `packages/ui/src/styles/assets/`

## Problem / feature

The four glass appearances (`glass`, `glass-frost`, `glass-crystal`, `glass-smoke`) painted
their body backdrop with radial gradients only. A gradient is a smooth field, so the
`backdrop-filter` on the floating panes had almost nothing to refract and the panels read
as flat cards with a bright rim. The requirement: when a glass-type appearance is active,
the body background is a supplied photograph instead of the gradients.

## Measured data / evidence

| Item             | Value                                                                             |
| ---------------- | --------------------------------------------------------------------------------- |
| Source asset     | `background-glass-…jpg`, 3840×2160, 1 752 380 bytes                               |
| Glass panel fill | 3–13 % white (`--color-surface-raised` per variant)                               |
| Asset character  | bright pastel (near-white corners), i.e. worst case for near-white text           |
| Build output     | `dist/assets/app-backdrop-glass-Qo3t9Tu9.jpg` in both `apps/admin` and `apps/web` |
| Gates            | `quality:tokens`, `quality:themes`, `quality:docs` → 0 violations; prettier clean |

## Root cause / design rationale

| Decision                                                                                                                                      | Reason                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset lives next to the token file (`packages/ui/src/styles/assets/`), referenced as a relative `url()` **inside** the `--app-backdrop` token | Vite rewrites it to a hashed build asset, so no `public/` copy step and no path tied to one app. The token keeps owning the appearance.                                                                                                                                                        |
| `body` gains `background-size: cover`, `background-repeat: no-repeat`, `background-position: center`                                          | A photograph has an intrinsic size and would otherwise tile at 3840×2160. Gradients are box-sized, so the three properties are invisible for `ambient`.                                                                                                                                        |
| A per-variant dark scrim (`linear-gradient` in the variant's base hue, 0.54–0.78 alpha) is the top layer                                      | Text sits on photograph + scrim + thin fill. Without the scrim the near-white text tokens land near 1.5:1 on the brightest areas — and no panel recipe can fix that, because the panel _is_ the thin layer. Alpha climbs as the fill gets thinner (`glass-crystal` 0.78 … `glass-smoke` 0.54). |
| The variant gradients stay listed behind the photograph                                                                                       | They are the fallback for a failed asset request; keeping them costs nothing and keeps the variant intent documented.                                                                                                                                                                          |
| The four variants share one photograph, differ by fill/rim/blur/scrim                                                                         | One asset instead of four; the family stays recognisable because the reasons the variants exist (fill opacity, rim brightness, blur radius) are unchanged.                                                                                                                                     |

## Solution / implementation

| File                                                                      | Change                                                                                                                                                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/styles/assets/app-backdrop-glass.jpg`                    | new asset (copy of the supplied image)                                                                                                                                                         |
| `packages/ui/src/styles/theme.css`                                        | `body` background sizing triple; `--app-backdrop` for all four glass blocks = scrim + `url(...)` + existing gradients; glass-family doc comment extended with the rationale and the scrim rule |
| `docs/Specs/UI-Architecture.md`                                           | §3.2.2 token row for `--app-backdrop` rewritten; new paragraph listing the three consequences (token-owned asset, `cover` sizing, scrim); header date/summary                                  |
| `docs/history/2026-11-08--13-15-00-glass-family-photographic-backdrop.md` | change narrative                                                                                                                                                                               |

## Outcome and how to verify

Selecting any glass appearance paints the photograph, darkened by the variant's scrim, with
the panes now refracting real structure.

```powershell
pnpm --filter @callback/admin build     # expect dist/assets/app-backdrop-glass-*.jpg
npx prettier --check "packages/ui/src/styles/theme.css"
pnpm quality:tokens
pnpm quality:themes
pnpm quality:docs
```

Manual: admin header theme selector → `glass`, `glass-frost`, `glass-crystal`, `glass-smoke`;
the photo is visible behind the shell, and dialog / drawer / tooltip blurs show its structure.

## Follow-ups

- The asset is a single 4K JPEG (~1.7 MB); a phone downloads all of it. A 1280/1920 variant
  plus `image-set()` in the token is the next step if load size matters.
- `apps/web` also emits the asset because it imports the same token file, although it never
  applies a glass theme (never fetched, only storage in the web dist).
- Contrast is derived from a fixed uniform scrim; a future per-variant measurement pass
  (`prefers-contrast: more` already forces opaque surfaces) could tune the alpha values.
