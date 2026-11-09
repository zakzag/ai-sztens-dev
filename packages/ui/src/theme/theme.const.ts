/**
 * The appearance names, in display order (AIS-165).
 *
 * This module is the single home of the list: the admin header's select box
 * derives its options from {@link THEME_NAMES} through the provider's own
 * constants, and the token file's `[data-theme=…]` blocks are named after the
 * very same strings.
 */

import type { ThemeName } from './theme.interface.js';

/**
 * The appearance that needs no override.
 *
 * It is also the selected-on-first-visit appearance: the `@theme` block in
 * `theme.css` holds these values, so the engine never has to write an attribute
 * to reach it.
 */
export const DEFAULT_THEME_NAME: ThemeName = 'dark';

/**
 * Every appearance the token file implements, in display order.
 *
 * The order is also the option order of the header's select box: the two
 * neutral appearances, the warm one, and glass last because it is the only one
 * that changes the *depth* language, not just the palette (AIS-167).
 */
export const THEME_NAMES: readonly ThemeName[] = [
  'light',
  DEFAULT_THEME_NAME,
  'ambient',
  'glass',
  'glass-frost',
  'glass-crystal',
  'glass-smoke',
];

/**
 * The blur affordance of the glass appearance (AIS-166).
 *
 * `backdrop-filter` is a property, not a token value, so it cannot be switched
 * by a theme block; the recipes that own a *floating* surface therefore carry
 * this utility unconditionally. It reads `--blur-glass` / `--saturate-glass`,
 * which are `0px` / `100%` for every opaque appearance — so the class is a
 * visual no-op there and no component has to branch on the theme.
 *
 * Declared once here, because a class name repeated in ten recipes is a rename
 * hazard (the same reason `placeholder:` and friends are not retyped).
 */
export const SURFACE_GLASS_CLASS = 'surface-glass';

/**
 * The catch-light of the static glass surfaces.
 *
 * `surface-glass` bundles the blur with the sheen, and blur is reserved for the
 * floating layers — one `backdrop-filter` per scrolling card or table shell is the
 * known frame-cost worst case. Cards and tables still have to glint, otherwise a
 * thick rim reads as painted plastic, so they carry this **gloss-only** utility
 * instead. It applies the same `--glass-sheen` gradient and is a no-op outside the
 * glass family, where `--glass-sheen` is `none`.
 */
export const SHEEN_GLASS_CLASS = 'sheen-glass';
