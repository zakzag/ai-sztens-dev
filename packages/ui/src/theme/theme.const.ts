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

/** Every appearance the token file implements, in display order. */
export const THEME_NAMES: readonly ThemeName[] = ['light', DEFAULT_THEME_NAME, 'ambient'];
