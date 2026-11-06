/**
 * Types of the appearance selector of the admin header (AIS-147, AIS-148).
 *
 * The selector is **UI only**: the theme is not applied anywhere yet, so the
 * value type describes a choice, not a feature (AIS-140 `D3`).
 */

/** One selectable appearance. */
export type ThemeOption = 'light' | 'dark' | 'ambient';

/**
 * One entry of the appearance list.
 *
 * It deliberately carries **no** icon: the selector is a combobox, and an
 * `<option>` inside a listbox is text-only (AIS-148).
 */
export interface ThemeOptionEntry {
  /** Submitted value of the combobox option. */
  readonly value: ThemeOption;
  /** Visible label of the combobox option. */
  readonly label: string;
}

/**
 * The single state object of {@link ThemeSelector}.
 *
 * `selected` and `query` live together, because the combobox is fully
 * controlled (AIS-113 **D5**): the typed text is an intermediate filter, not a
 * second source of truth. Keeping them in one object means "reset the text to
 * the selection" is one atomic update instead of two that can disagree.
 */
export interface ThemeSelectorState {
  /** The appearance the user actually chose. */
  readonly selected: ThemeOption;
  /** Text currently in the combobox input (the filter query). */
  readonly query: string;
}

/** Props of {@link ThemeSelector}. */
export interface ThemeSelectorProps {
  /**
   * Receives the newly selected value after the visual selection moved.
   *
   * It is a **port**: the header currently hands over a documented no-op,
   * because applying a theme (tokens, `data-theme`, persistence) is not part of
   * AIS-147 (AIS-140 `D3`).
   */
  readonly onThemeChange: (value: ThemeOption) => void;
}
