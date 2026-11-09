/**
 * Pure helpers of the appearance selector of the admin header
 * (AIS-147, AIS-149).
 *
 * Kept out of the component for two reasons: a `.const.ts` module cannot hold
 * JSX, and neither mapping has React state, so both must stay testable as plain
 * functions (React coding standards §5).
 */

import { createElement } from 'react';
import { THEME_OPTION_ICONS, THEME_SELECTOR_OPTIONS } from './layout.const.js';
import { InvalidThemeOptionError } from './theme-selector.errors.js';
import type { ThemeOption } from './theme-selector.interface.js';
import type { SelectMenuOption } from '@callback/ui';

/**
 * Builds the option list of the appearance select box.
 *
 * Each entry carries its icon as a **decorative** element: the icon set marks
 * every SVG `aria-hidden`, so the accessible name of an option stays the label
 * alone — in the trigger and in the list (AIS-149).
 *
 * @returns one `SelectMenuOption` per appearance, in display order.
 */
export function toThemeSelectOptions(): readonly SelectMenuOption[] {
  return THEME_SELECTOR_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    icon: createElement(THEME_OPTION_ICONS[option.value]),
  }));
}

/**
 * Narrows a raw select value to the `ThemeOption` union.
 *
 * `SelectMenu.onValueChange` reports a `string`, because the primitive serves
 * every caller. This selector owns the only option list, so anything outside it
 * is a contract violation rather than a user choice.
 *
 * @param value - the raw value reported by the select box.
 * @returns the same value, narrowed to {@link ThemeOption}.
 * @throws {InvalidThemeOptionError} when the value is not a declared appearance.
 */
export function toThemeOption(value: string): ThemeOption {
  const match = THEME_SELECTOR_OPTIONS.find((option) => option.value === value);

  if (match === undefined) {
    throw new InvalidThemeOptionError(value);
  }

  return match.value;
}
