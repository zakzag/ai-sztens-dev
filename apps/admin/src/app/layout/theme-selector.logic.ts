/**
 * Pure helpers of the appearance selector of the admin header
 * (AIS-147, AIS-148).
 *
 * Kept out of the component for two reasons: a `.const.ts` module cannot hold
 * JSX, and neither mapping has React state, so both must stay testable as plain
 * functions (React coding standards §5).
 */

import { THEME_SELECTOR_OPTIONS } from './layout.const.js';
import { InvalidThemeOptionError } from './theme-selector.errors.js';
import type {
  ThemeOption,
  ThemeOptionEntry,
} from './theme-selector.interface.js';
import type { ComboboxOption } from '@callback/ui';

/**
 * Finds the single declared entry of an appearance.
 *
 * One lookup, two public projections: the selector owns the only option list,
 * so a value outside it is a contract violation rather than a user choice.
 *
 * @param value - the raw value reported by the combobox.
 * @returns the matching entry of `THEME_SELECTOR_OPTIONS`.
 * @throws {InvalidThemeOptionError} when the value is not a declared appearance.
 */
function findThemeOption(value: string): ThemeOptionEntry {
  const match = THEME_SELECTOR_OPTIONS.find((option) => option.value === value);

  if (match === undefined) {
    throw new InvalidThemeOptionError(value);
  }

  return match;
}

/**
 * Builds the option list of the appearance combobox.
 *
 * The entries are plain `{ value, label }` pairs: a listbox option is
 * text-only, so the icons the previous radio group rendered have no place here
 * (AIS-148).
 *
 * @returns one `ComboboxOption` per appearance, in display order.
 */
export function toThemeComboboxOptions(): readonly ComboboxOption[] {
  return THEME_SELECTOR_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));
}

/**
 * Narrows a raw combobox value to the `ThemeOption` union.
 *
 * `Combobox.onSelect` reports a `string`, because the primitive serves every
 * caller.
 *
 * @param value - the raw value reported by the combobox.
 * @returns the same value, narrowed to {@link ThemeOption}.
 * @throws {InvalidThemeOptionError} when the value is not a declared appearance.
 */
export function toThemeOption(value: string): ThemeOption {
  return findThemeOption(value).value;
}

/**
 * Reads the visible label of an appearance.
 *
 * It is what the combobox input shows while the listbox is closed, i.e. the
 * "only the last selected is visible" contract (AIS-148).
 *
 * @param value - a declared appearance.
 * @returns the Hungarian label of {@link value}.
 * @throws {InvalidThemeOptionError} when the value is not a declared appearance.
 */
export function toThemeLabel(value: ThemeOption): string {
  return findThemeOption(value).label;
}
