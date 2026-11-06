import { SelectMenu } from '@callback/ui';
import type { SelectMenuOption } from '@callback/ui';
import { useState } from 'react';
import { DEFAULT_THEME_OPTION, THEME_SELECTOR_LABEL } from '../layout.const.js';
import {
  toThemeOption,
  toThemeSelectOptions,
} from '../theme-selector.logic.js';
import type {
  ThemeOption,
  ThemeSelectorProps,
} from '../theme-selector.interface.js';

/**
 * The option list is derived once, at module scope, so every render hands the
 * primitive the **same** array and the options are never remounted by an
 * identity change.
 */
const THEME_SELECT_OPTIONS: readonly SelectMenuOption[] =
  toThemeSelectOptions();

/**
 * Appearance selector of the admin header (AIS-147, AIS-149).
 *
 * A **select box, not a combobox and not a radio group**: the closed trigger
 * shows only the chosen appearance (icon + label + chevron), and clicking it
 * lists the three appearances — icon + label each — without a search field.
 * Nothing else follows from the choice; the selector is still a **UI contract,
 * not a theme implementation** (AIS-140 `D3`):
 *
 * - the selection lives in a local `useState`, so it is gone on navigation —
 *   which is honest, because nothing applied it in the first place;
 * - no `<html>` attribute, no token override and no `localStorage` /
 *   `sessionStorage` write happens here;
 * - the change is forwarded through the `onThemeChange` **port**, which the
 *   header currently fills with a documented no-op.
 *
 * @param props - see {@link ThemeSelectorProps}.
 * @returns the appearance select box.
 */
export function ThemeSelector({ onThemeChange }: ThemeSelectorProps) {
  const [selected, setSelected] = useState<ThemeOption>(DEFAULT_THEME_OPTION);

  /**
   * Moves the selection and reports it through the port.
   *
   * @param value - the raw value reported by the select box.
   */
  function handleValueChange(value: string): void {
    const next = toThemeOption(value);

    setSelected(next);
    onThemeChange(next);
  }

  return (
    <SelectMenu
      label={THEME_SELECTOR_LABEL}
      options={THEME_SELECT_OPTIONS}
      value={selected}
      onValueChange={handleValueChange}
    />
  );
}
