/**
 * Geometry, labels and appearance values of the admin shell header (AIS-147).
 *
 * Two reasons everything lives here instead of inline in the JSX:
 *
 * - the header is **fixed height** and **sticky**, so the z-index and the two
 *   row heights are a contract with the overlay primitives, not a local style;
 * - the tests assert the very same constants, so a magic string can never drift
 *   between the component and its specification.
 */

import {
  CloudIcon,
  DropletIcon,
  LayersIcon,
  MoonIcon,
  SnowflakeIcon,
  SunIcon,
  SunsetIcon,
} from '@callback/ui';
import type { IconProps } from '@callback/ui';
import type { ComponentType } from 'react';
import type {
  ThemeOption,
  ThemeOptionEntry,
} from './theme-selector.interface.js';

/**
 * Stacking class of the sticky header.
 *
 * `z-30` keeps the header **below** every overlay: the log drawer (`z-40`), the
 * dialog content (`z-50`) and the toast stack (`z-60`). A modal or the log
 * panel must therefore paint over the header instead of sliding under it
 * (AIS-140 `D8`).
 */
export const ADMIN_HEADER_Z_INDEX = 'z-30';

/** Height of the brand/action row. Fixed so scrolling never shifts the shell. */
export const ADMIN_HEADER_TOP_ROW_HEIGHT = 'h-14';

/** Height of the navigation/breadcrumb row. */
export const ADMIN_HEADER_CRUMB_ROW_HEIGHT = 'h-10';

/** Horizontal padding shared by both header rows and `<main>` (full bleed). */
export const ADMIN_HEADER_PADDING_X = 'px-6';

/** Accessible name of the (deliberately inert) user-settings button. */
export const APP_USER_SETTINGS_ARIA_LABEL = 'Felhasználói beállítások';

/** Accessible label of the appearance combobox (`<label>` text). */
export const THEME_SELECTOR_LABEL = 'Megjelenés';

/** Value of the light appearance. */
export const THEME_OPTION_LIGHT: ThemeOption = 'light';

/**
 * Value of the dark appearance.
 *
 * It is also the selected-on-mount appearance: the token set of `theme.css` is
 * the dark one, so the radio must not claim otherwise (AIS-140 `D3`). One
 * constant, so the two meanings cannot drift.
 */
export const DEFAULT_THEME_OPTION: ThemeOption = 'dark';

/** Value of the ambient appearance. */
export const THEME_OPTION_AMBIENT: ThemeOption = 'ambient';

/**
 * Value of the balanced glass appearance (AIS-166, AIS-167, AIS-169).
 *
 * The glass *family* is the only appearance that changes the **depth language** —
 * translucent surfaces, a bright bevelled rim, a specular sheen and a backdrop
 * blur — instead of only the palette. The four members differ in how much glass
 * they are, so the choice between them is made in the UI, not in the code.
 */
export const THEME_OPTION_GLASS: ThemeOption = 'glass';

/** Value of the milky, heavy-blur glass appearance (AIS-169). */
export const THEME_OPTION_GLASS_FROST: ThemeOption = 'glass-frost';

/** Value of the almost-invisible, brightest-rim glass appearance (AIS-169). */
export const THEME_OPTION_GLASS_CRYSTAL: ThemeOption = 'glass-crystal';

/** Value of the dark, dense smoked-glass appearance (AIS-169). */
export const THEME_OPTION_GLASS_SMOKE: ThemeOption = 'glass-smoke';

/** Label of the light appearance. */
export const THEME_OPTION_LIGHT_LABEL = 'Világos';

/** Label of the dark appearance. */
export const THEME_OPTION_DARK_LABEL = 'Sötét';

/** Label of the ambient appearance. */
export const THEME_OPTION_AMBIENT_LABEL = 'Ambient';

/** Label of the glass appearance. */
export const THEME_OPTION_GLASS_LABEL = 'Üveg';

/** Label of the milky glass appearance. */
export const THEME_OPTION_GLASS_FROST_LABEL = 'Fagyott üveg';

/** Label of the crystal glass appearance. */
export const THEME_OPTION_GLASS_CRYSTAL_LABEL = 'Kristályüveg';

/** Label of the smoked glass appearance. */
export const THEME_OPTION_GLASS_SMOKE_LABEL = 'Füstüveg';

/**
 * The appearance options in display order.
 *
 * The three neutral appearances come first, then the glass family from the
 * clearest to the densest: frost (heaviest fill), crystal (thin, bright rim),
 * glass (balanced) and smoke (dark) — the order a reviewer naturally reads them
 * in when comparing.
 */
export const THEME_SELECTOR_OPTIONS: readonly ThemeOptionEntry[] = [
  { value: THEME_OPTION_LIGHT, label: THEME_OPTION_LIGHT_LABEL },
  { value: DEFAULT_THEME_OPTION, label: THEME_OPTION_DARK_LABEL },
  { value: THEME_OPTION_AMBIENT, label: THEME_OPTION_AMBIENT_LABEL },
  { value: THEME_OPTION_GLASS, label: THEME_OPTION_GLASS_LABEL },
  { value: THEME_OPTION_GLASS_FROST, label: THEME_OPTION_GLASS_FROST_LABEL },
  {
    value: THEME_OPTION_GLASS_CRYSTAL,
    label: THEME_OPTION_GLASS_CRYSTAL_LABEL,
  },
  { value: THEME_OPTION_GLASS_SMOKE, label: THEME_OPTION_GLASS_SMOKE_LABEL },
];

/**
 * Icon of each appearance.
 *
 * The map holds the **component**, not an element, so the selector can render it
 * with its own props and this module stays free of JSX (a `.const.ts` file). The
 * select box shows the icon both on the trigger and in the option list
 * (AIS-149).
 */
export const THEME_OPTION_ICONS: Readonly<
  Record<ThemeOption, ComponentType<IconProps>>
> = {
  [THEME_OPTION_LIGHT]: SunIcon,
  [DEFAULT_THEME_OPTION]: MoonIcon,
  [THEME_OPTION_AMBIENT]: SunsetIcon,
  [THEME_OPTION_GLASS]: LayersIcon,
  [THEME_OPTION_GLASS_FROST]: SnowflakeIcon,
  [THEME_OPTION_GLASS_CRYSTAL]: DropletIcon,
  [THEME_OPTION_GLASS_SMOKE]: CloudIcon,
};
