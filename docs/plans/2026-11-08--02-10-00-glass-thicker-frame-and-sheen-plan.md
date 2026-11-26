# Glass appearances — thicker, glossier frame (plan)

**Created:** 2026-11-08 02:10 (Europe/Budapest)
**Scope:** [`packages/ui/src/styles/theme.css`](../../packages/ui/src/styles/theme.css), the appearance-token gate, `Card`/`Table`

## Problem

Asked for by the operator on the running admin UI: the four glass appearances
(`glass`, `glass-frost`, `glass-crystal`, `glass-smoke`) look too flat. The frame
is a 1px rim, which reads as a divider rather than a pane edge, and the gloss is
only visible on the floating layers (dialog, drawer, toast…), so a page made of
cards and tables has no glass catch-light at all.

## Measured starting point (before the change)

| Token                               | `dark` / `light` / `ambient`      | glass family                               |
| ----------------------------------- | --------------------------------- | ------------------------------------------ |
| `--border-width-hairline`           | `1px`                             | `1px` (inherited — no override existed)    |
| `--border-width-strong`             | `2px`                             | `2px` (inherited)                          |
| raised-surface rim alphas           | `0.30 / 0.36 / 0.45` (dark greys) | `0.22 – 0.65` (white)                      |
| `--glass-sheen`                     | `none`                            | **one** 135° gradient, alpha `0.08 – 0.26` |
| `surface-glass` on `Card` / `Table` | absent                            | absent (blur is banned there on purpose)   |

Two facts explain the flat look: (1) thickness was a single global ladder, so glass
could not be thicker than dark even in principle; (2) the only sheen carrier was
`surface-glass`, which is banned on scrolling furniture for frame-cost reasons —
so the surfaces a user looks at all day got translucency but no highlight.

## Decisions

| #   | Decision                                                                                                                                                      | Why                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Width is **appearance state**: the glass blocks restate `--border-width-*` as `2 / 2.5 / 3px`; the opaque appearances keep the `1 / 1.5 / 2px` `:root` ladder | A pane edge _is_ thicker than a divider. Making it a token keeps components out of it — no `[data-theme]` selector, no per-component branch.                                                                                                              |
| D2  | The three border-width names are added to `THEME_STATE_TOKENS` in the appearance gate                                                                         | The gate rejects any token an appearance block declares that `@theme` does not; width is not a Tailwind namespace, so it belongs in the same list as `--blur-glass`. Allowed, not required: an appearance that omits them inherits the ladder.            |
| D3  | Rim alphas pushed up per variant (`+0.04 … +0.08`) instead of adding a new rim token                                                                          | Width alone looks like a shadow; brightness alone looks like a hairline. Both together are the "thick glass" cue, and both are already tokens.                                                                                                            |
| D4  | `--glass-sheen` gains a **second, narrow** specular band (`102deg`) on top of the 135° body gradient                                                          | A single wide gradient reads as a tint. The narrow band is the glint that says "glass". Layering two gradients in one custom property needs no new token.                                                                                                 |
| D5  | New `@utility sheen-glass` + `SHEEN_GLASS_CLASS`, applied to `Card` and the `Table` shell                                                                     | Splits the gloss from the blur. The blur stays banned on scrolling furniture (`backdrop-filter` per row is the known frame-cost worst case); the gradient is a paint, not a filter, and `--glass-sheen: none` makes it a no-op in the opaque appearances. |
| D6  | Readability fallbacks untouched                                                                                                                               | `prefers-reduced-transparency` / `prefers-contrast` are about transparency and legibility, not frame weight; the thick rim survives them, which is the correct trade.                                                                                     |

## Rejected alternatives

| Alternative                                         | Why not                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Hard-code `border-2` in the primitives              | A component would then decide appearance — the one thing §7 forbids; and every opaque theme would inherit it. |
| Put the sheen on `Card`/`Table` via `surface-glass` | Brings the banned `backdrop-filter` back onto the scrolling flow.                                             |
| A new `--glass-frame` shadow token                  | Shadows are already the bevel slot; a fourth depth token for one family would duplicate the concept.          |
| Animate the glint ("sweeping reflection")           | Motion on a full-page surface; also unverifiable in jsdom, so it could not ship with a meaningful test.       |

## Verification

- `pnpm quality:themes` — the appearance gate still passes with the widened token set.
- `node --test scripts/quality/theme-tokens.logic.test.mjs` — includes the new "thicker frame" case.
- `pnpm --filter @callback/ui test` — `surface-glass.test.tsx` now also pins `sheen-glass`
  on `Card` and `Table`, and pins that the card still does **not** carry the blur class.
- Manual: switch the header selector to each of the four glass appearances and check that
  cards, tables and overlays all show a visible bright rim and a diagonal highlight.
