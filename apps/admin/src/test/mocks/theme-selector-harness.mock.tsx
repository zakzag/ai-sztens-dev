/**
 * Stateful double of the appearance selector's caller (AIS-167).
 *
 * `ThemeSelector` is a **purely controlled** select box: it renders `value` and
 * reports a pick. A test therefore needs something that owns the state, exactly
 * as the theme provider does in the app, or the selection could never move. The
 * harness keeps that owner out of the test file (project testing rules) and keeps
 * the double honest about the real contract: no attribute, no storage.
 */

import { useState } from 'react';
import type { ReactElement } from 'react';
import { DEFAULT_THEME_OPTION } from '../../app/layout/layout.const.js';
import { ThemeSelector } from '../../app/layout/ui/ThemeSelector.js';
import type { ThemeOption } from '../../app/layout/theme-selector.interface.js';

/** Props of {@link ThemeSelectorHarness}. */
export interface ThemeSelectorHarnessProps {
  /** The appearance the control starts with; defaults to the default one. */
  readonly initialValue?: ThemeOption;
  /** Observes every value the control reports. */
  readonly onChange?: (value: ThemeOption) => void;
}

/**
 * Renders {@link ThemeSelector} with its own `useState`.
 *
 * @param props - see {@link ThemeSelectorHarnessProps}.
 * @returns the selector, wired to local state.
 */
export function ThemeSelectorHarness({
  initialValue = DEFAULT_THEME_OPTION,
  onChange,
}: ThemeSelectorHarnessProps): ReactElement {
  const [value, setValue] = useState<ThemeOption>(initialValue);

  return (
    <ThemeSelector
      value={value}
      onThemeChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}
