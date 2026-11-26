/**
 * Probe for the theme context (AIS-165).
 *
 * The provider's contract is only observable through the hook, so the suites
 * render this instead of a real page: it prints the appearance it sees and can
 * apply one. It lives here rather than inside a test file (project testing
 * rules), because three suites use it.
 */

import type { ThemeName } from '@callback/ui';
import type { ReactElement } from 'react';
import { useTheme } from '../../app/theme/use-theme.js';

/** Props of {@link ThemeProbe}. */
export interface ThemeProbeProps {
  /** The appearance the probe's button applies; defaults to `light`. */
  readonly target?: ThemeName;
}

/**
 * Renders the appearance from the context and a button that changes it.
 *
 * @param props - see {@link ThemeProbeProps}.
 * @returns the probe markup.
 * @throws {MissingThemeProviderError} when rendered outside `<ThemeProvider>`.
 */
export function ThemeProbe({ target = 'light' }: ThemeProbeProps): ReactElement {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <output data-testid="theme">{theme}</output>
      <button type="button" onClick={() => setTheme(target)}>
        apply theme
      </button>
    </div>
  );
}
