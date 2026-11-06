/**
 * Types of the appearance selector of the admin header (AIS-147, AIS-149).
 *
 * The selector is **UI only**: the theme is not applied anywhere yet, so the
 * value type describes a choice, not a feature (AIS-140 `D3`).
 */

/** One selectable appearance. */
export type ThemeOption = 'light' | 'dark' | 'ambient';

/**
 * One entry of the appearance list.
 *
 * It deliberately carries **no** icon: a `.const.ts` module cannot hold JSX, so
 * the icon component is looked up by {@link ThemeOption} in
 * `layout.const.ts` and rendered by the selector.
 */
export interface ThemeOptionEntry {
  /** Submitted value of the select option. */
  readonly value: ThemeOption;
  /** Visible label of the select option. */
  readonly label: string;
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
