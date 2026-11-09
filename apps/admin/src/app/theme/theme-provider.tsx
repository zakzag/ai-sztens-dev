import type { ThemeName } from '@callback/ui';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { THEME_ATTRIBUTE } from './theme.const.js';
import { readStoredTheme, writeStoredTheme } from './theme.logic.js';
import type { ThemeContextValue, ThemeProviderProps, ThemeStorage } from './theme.interface.js';

/**
 * The theme context of the `app/` layer.
 *
 * `null` means "no provider above me" — the hook turns that into a loud error
 * instead of a silent default, so a missing provider cannot look like a broken
 * selector.
 */
export const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * The storage the engine may use, or `null` when the browser forbids it.
 *
 * Reading `window.localStorage` itself throws in hardening scenarios (Safari
 * private mode, a third-party iframe without `allow-same-origin`), which is why
 * even the property access is guarded and not just the calls.
 *
 * @returns the storage, or `null`.
 */
function resolveThemeStorage(): ThemeStorage | null {
  try {
    return window.localStorage;
  } catch {
    // Expected in the environments above; the theme then lives for the session
    // only, which is the documented degradation (AIS-165 D4).
    return null;
  }
}

/**
 * Writes the appearance onto the document.
 *
 * The token blocks in `theme.css` are selected by
 * `:root[data-theme="…"]`, so this one attribute repaints every surface, border,
 * shadow and text colour of the whole UI.
 *
 * @param theme - the appearance to apply.
 */
function applyThemeAttribute(theme: ThemeName): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
}

/**
 * Owns the applied appearance of the admin application (AIS-165).
 *
 * Why a provider and not a store: the appearance is document state mirrored into
 * `localStorage`, not server state and not page state. It is created once, at
 * the app shell, and stays alive across navigation — which is exactly the
 * difference from the `useState` the selector used to own (AIS-140 `D3`).
 *
 * Two writes happen for one selection, and both are deliberate:
 *
 * 1. the attribute goes onto `<html>` from an effect, so the repaint is a
 *    consequence of the state change rather than a side effect of the click;
 * 2. `localStorage` is written in the setter, because only a user action should
 *    persist — mounting the provider must not write anything.
 *
 * The first paint does not depend on any of this: the boot script in
 * [`index.html`](../../../index.html:1) sets the attribute before the bundle
 * runs, and this provider merely keeps it in sync afterwards.
 *
 * @param props - see {@link ThemeProviderProps}.
 * @returns the children, wrapped in the theme context.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  /**
   * Seeded from the storage, so a subtree that renders before the first effect
   * already reports the persisted appearance instead of flapping from the
   * default.
   */
  const [theme, setThemeState] = useState<ThemeName>(() =>
    readStoredTheme(resolveThemeStorage()),
  );

  useEffect(() => {
    applyThemeAttribute(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeName): void => {
    setThemeState(next);
    // The result is intentionally ignored: a failed write costs persistence
    // only, and the appearance still applies to this session (AIS-165 D4).
    writeStoredTheme(resolveThemeStorage(), next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
