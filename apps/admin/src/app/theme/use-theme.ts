import { useContext } from 'react';
import { MissingThemeProviderError } from './theme.errors.js';
import { ThemeContext } from './theme-provider.js';
import type { ThemeContextValue } from './theme.interface.js';

/**
 * The applied appearance and the action that changes it (AIS-165).
 *
 * The app layer reads the theme **only** through this hook: the header's select
 * box calls `setTheme`, and nothing else needs to know that the implementation
 * writes a `data-theme` attribute and a `localStorage` entry.
 *
 * @returns the current appearance and its setter.
 * @throws {MissingThemeProviderError} when called outside `<ThemeProvider>`.
 */
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);

  if (value === null) {
    throw new MissingThemeProviderError();
  }

  return value;
}
