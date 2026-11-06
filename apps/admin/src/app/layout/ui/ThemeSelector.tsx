import { Combobox } from '@callback/ui';
import type { ComboboxOption } from '@callback/ui';
import { useState } from 'react';
import {
  DEFAULT_THEME_OPTION,
  THEME_SELECTOR_ID,
  THEME_SELECTOR_LABEL,
  THEME_SELECTOR_PLACEHOLDER,
  THEME_SELECTOR_WIDTH_CLASS,
} from '../layout.const.js';
import {
  toThemeComboboxOptions,
  toThemeLabel,
  toThemeOption,
} from '../theme-selector.logic.js';
import type {
  ThemeSelectorProps,
  ThemeSelectorState,
} from '../theme-selector.interface.js';

/**
 * The option list is derived once, at module scope, so every render hands the
 * primitive the **same** array and the options are never remounted by an
 * identity change.
 */
const THEME_COMBOBOX_OPTIONS: readonly ComboboxOption[] =
  toThemeComboboxOptions();

/**
 * Appearance selector of the admin header (AIS-147, AIS-148).
 *
 * A **combobox, not a radio group**: three always-visible options did not fit
 * the fixed-height header band, so the closed control shows **only the last
 * selected appearance** and the list opens on focus. Nothing else follows from
 * the choice — the selector is still a **UI contract, not a theme
 * implementation** (AIS-140 `D3`):
 *
 * - the selection lives in a local `useState`, so it is gone on navigation —
 *   which is honest, because nothing applied it in the first place;
 * - no `<html>` attribute, no token override and no `localStorage` /
 *   `sessionStorage` write happens here;
 * - the change is forwarded through the `onThemeChange` **port**, which the
 *   header currently fills with a documented no-op.
 *
 * The typed text is an intermediate filter, never the selection: `onOpen` drops
 * it (a pre-filled selection would filter the list to that one entry) and
 * `onClose` restores the label of the chosen appearance, so a closed control
 * shows — and a reopened one lists — exactly what the user committed.
 *
 * @param props - see {@link ThemeSelectorProps}.
 * @returns the appearance combobox.
 */
export function ThemeSelector({ onThemeChange }: ThemeSelectorProps) {
  const [state, setState] = useState<ThemeSelectorState>(() => ({
    selected: DEFAULT_THEME_OPTION,
    query: toThemeLabel(DEFAULT_THEME_OPTION),
  }));

  /**
   * Commits the chosen appearance and reports it through the port.
   *
   * @param value - the raw value reported by the combobox.
   */
  function handleSelect(value: string): void {
    const next = toThemeOption(value);

    setState({ selected: next, query: toThemeLabel(next) });
    onThemeChange(next);
  }

  /**
   * Mirrors the typed filter text; it never touches the selection.
   *
   * @param query - the text currently in the input.
   */
  function handleInputValueChange(query: string): void {
    setState((previous) => ({ ...previous, query }));
  }

  /**
   * Drops the filter text so the opened list shows every appearance.
   */
  function handleOpen(): void {
    setState((previous) => ({ ...previous, query: '' }));
  }

  /**
   * Restores the chosen label once the listbox closed, keeping only the
   * selection visible.
   */
  function handleClose(): void {
    setState((previous) => ({
      ...previous,
      query: toThemeLabel(previous.selected),
    }));
  }

  return (
    <>
      <label htmlFor={THEME_SELECTOR_ID} className="sr-only">
        {THEME_SELECTOR_LABEL}
      </label>
      <Combobox
        id={THEME_SELECTOR_ID}
        className={THEME_SELECTOR_WIDTH_CLASS}
        options={THEME_COMBOBOX_OPTIONS}
        value={state.selected}
        inputValue={state.query}
        placeholder={THEME_SELECTOR_PLACEHOLDER}
        onSelect={handleSelect}
        onInputValueChange={handleInputValueChange}
        onOpen={handleOpen}
        onClose={handleClose}
      />
    </>
  );
}
