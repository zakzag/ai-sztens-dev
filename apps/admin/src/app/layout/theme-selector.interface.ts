/**
 * Types of the appearance selector of the admin header (AIS-147, AIS-149,
 * AIS-167).
 *
 * The value type is **`ThemeName` from `@callback/ui`**, not a second union: the
 * token file and the selector cannot drift apart, so the selector can never offer
 * an appearance that has no token block and the engine can never accept one the
 * selector cannot produce.
 */

import type { ThemeName } from '@callback/ui';

/** One selectable appearance — the token contract's own union, not a copy. */
export type ThemeOption = ThemeName;

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
   * The appearance currently applied (AIS-167).
   *
   * The selector no longer owns the choice: `app/theme/theme-provider.tsx` does,
   * because the appearance outlives navigation. Keeping the control **purely
   * controlled** means it applies nothing itself — no `<html>` attribute, no
   * storage write — which is why its test can still assert the absence of side
   * effects, and the wiring is asserted once, on `AdminLayout`.
   */
  readonly value: ThemeOption;

  /** Receives the newly selected value after the visual selection moved. */
  readonly onThemeChange: (value: ThemeOption) => void;
}
