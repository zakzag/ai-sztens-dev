/**
 * Errors of the theme engine (AIS-165).
 */

/**
 * Thrown when a theme hook is called outside `<ThemeProvider>`.
 *
 * Same contract as the session and the notification store: a missing provider is
 * a wiring defect, so it fails loudly instead of silently falling back to the
 * default appearance — a silent fallback would look like "the selector does
 * nothing", which is exactly the defect AIS-165 exists to remove.
 */
export class MissingThemeProviderError extends Error {
  constructor() {
    super('useTheme must be used inside <ThemeProvider>.');
    this.name = 'MissingThemeProviderError';
  }
}
