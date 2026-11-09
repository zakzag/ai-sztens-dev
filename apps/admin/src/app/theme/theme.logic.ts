/**
 * Pure helpers of the theme engine (AIS-165).
 *
 * Nothing here touches the DOM or `window`: the storage is injected, so every
 * branch — valid value, unknown value, absent storage, throwing storage — is
 * testable without a browser (React coding standards §5).
 */

import { DEFAULT_THEME_NAME, THEME_NAMES } from '@callback/ui';
import type { ThemeName } from '@callback/ui';
import { THEME_STORAGE_KEY } from './theme.const.js';
import type { ThemeStorage } from './theme.interface.js';

/**
 * Narrows an arbitrary value to an implemented appearance.
 *
 * @param value - the raw value, typically what a storage or an attribute held.
 * @returns `true` when the value names an appearance the token file implements.
 */
export function isThemeName(value: unknown): value is ThemeName {
  if (typeof value !== 'string') {
    return false;
  }

  return THEME_NAMES.some((name) => name === value);
}

/**
 * Reads the persisted appearance.
 *
 * A missing entry, an entry that is no longer an implemented appearance (an old
 * build wrote it) and an unreadable storage all resolve to
 * {@link DEFAULT_THEME_NAME}: the boot must never fail because of a preference.
 *
 * @param storage - the storage to read, or `null` when the browser forbids it.
 * @returns the appearance to start with.
 */
export function readStoredTheme(storage: ThemeStorage | null): ThemeName {
  if (storage === null) {
    return DEFAULT_THEME_NAME;
  }

  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);

    return isThemeName(stored) ? stored : DEFAULT_THEME_NAME;
  } catch {
    // Reaching a storage that then refuses to be read (a revoked origin, an
    // exhausted quota on some engines) is the same case as having none at all.
    // It is deliberately not logged: a preference is not worth a console entry
    // on every boot, and the fallback is the documented behaviour (AIS-165 D4).
    return DEFAULT_THEME_NAME;
  }
}

/**
 * Persists the appearance.
 *
 * @param storage - the storage to write, or `null` when the browser forbids it.
 * @param theme - the appearance to remember.
 * @returns `true` when the value reached the storage, `false` when it did not —
 *   a failed write only costs persistence, the appearance still applies to the
 *   running document, so callers may ignore the result.
 */
export function writeStoredTheme(storage: ThemeStorage | null, theme: ThemeName): boolean {
  if (storage === null) {
    return false;
  }

  try {
    storage.setItem(THEME_STORAGE_KEY, theme);

    return true;
  } catch {
    // Same reasoning as in `readStoredTheme`: an unwritable storage leaves the
    // theme at session scope instead of breaking the selector.
    return false;
  }
}
