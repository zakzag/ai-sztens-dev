import { SelectMenu } from '@callback/ui';
import type { SelectMenuOption } from '@callback/ui';
import { THEME_SELECTOR_LABEL } from '../layout.const.js';
import {
  toThemeOption,
  toThemeSelectOptions,
} from '../theme-selector.logic.js';
import type { ThemeSelectorProps } from '../theme-selector.interface.js';

/**
 * The option list is derived once, at module scope, so every render hands the
 * primitive the **same** array and the options are never remounted by an
 * identity change.
 */
const THEME_SELECT_OPTIONS: readonly SelectMenuOption[] =
  toThemeSelectOptions();

/**
 * Appearance selector of the admin header (AIS-147, AIS-149, AIS-167).
 *
 * A **select box, not a combobox and not a radio group**: the closed trigger
 * shows only the chosen appearance (icon + label + chevron), and clicking it
 * lists the four appearances — icon + label each — without a search field.
 *
 * Since AIS-167 the control is **purely controlled**: `value` comes from the
 * theme provider and a pick is reported through `onThemeChange`. Applying the
 * appearance is therefore not this component's job — no `<html>` attribute, no
 * `localStorage`, no state — which keeps "a control does not own side effects"
 * testable and puts the wiring in exactly one place (`AdminLayout`).
 *
 * @param props - see {@link ThemeSelectorProps}.
 * @returns the appearance select box.
 */
export function ThemeSelector({ value, onThemeChange }: ThemeSelectorProps) {
  /**
   * Narrows the primitive's raw `string` to the appearance union before it
   * leaves the selector, so the header and the shell never see an unchecked
   * value.
   *
   * @param next - the raw value reported by the select box.
   */
  function handleValueChange(next: string): void {
    onThemeChange(toThemeOption(next));
  }

  return (
    <SelectMenu
      label={THEME_SELECTOR_LABEL}
      options={THEME_SELECT_OPTIONS}
      value={value}
      onValueChange={handleValueChange}
    />
  );
}
