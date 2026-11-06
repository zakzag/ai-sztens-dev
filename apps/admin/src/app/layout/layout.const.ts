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

/**
 * Id of the appearance combobox input.
 *
 * The listbox and every option id derive from it, so the id is a contract with
 * the `Combobox` primitive rather than a local detail (AIS-148).
 */
export const THEME_SELECTOR_ID = 'app-theme';

/**
 * Width of the combobox inside the fixed-height header row.
 *
 * A layout-only utility: the surface, border and depth come from the primitive,
 * so the header never restates the token recipe.
 */
export const THEME_SELECTOR_WIDTH_CLASS = 'w-40';

/**
 * Placeholder shown while the listbox is open and the filter text is empty.
 *
 * The input is deliberately emptied on open (AIS-148): a pre-filled selection
 * would filter the list down to that single appearance.
 */
export const THEME_SELECTOR_PLACEHOLDER = 'Keresés…';

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

/** Label of the light appearance. */
export const THEME_OPTION_LIGHT_LABEL = 'Világos';

/** Label of the dark appearance. */
export const THEME_OPTION_DARK_LABEL = 'Sötét';

/** Label of the ambient appearance. */
export const THEME_OPTION_AMBIENT_LABEL = 'Ambient';

/** The appearance options in display order. */
export const THEME_SELECTOR_OPTIONS: readonly ThemeOptionEntry[] = [
  { value: THEME_OPTION_LIGHT, label: THEME_OPTION_LIGHT_LABEL },
  { value: DEFAULT_THEME_OPTION, label: THEME_OPTION_DARK_LABEL },
  { value: THEME_OPTION_AMBIENT, label: THEME_OPTION_AMBIENT_LABEL },
];
