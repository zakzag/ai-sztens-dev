/**
 * Tests of the theme logic (AIS-165).
 *
 * The logic is pure: the storage is injected, so the suite covers every branch —
 * an implemented appearance, a value an older build wrote, an absent storage and
 * a storage that throws. Nothing here mounts React.
 */

import { DEFAULT_THEME_NAME, THEME_NAMES } from '@callback/ui';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createBrokenStorage,
  installRecordingStorages,
  type WebStorageHarness,
} from '../../test/mocks/web-storage.mock.js';
import { THEME_STORAGE_KEY } from './theme.const.js';
import { isThemeName, readStoredTheme, writeStoredTheme } from './theme.logic.js';

describe('isThemeName', () => {
  it('accepts every implemented appearance', () => {
    expect(isThemeName('light')).toBe(true);
    expect(isThemeName('dark')).toBe(true);
    expect(isThemeName('ambient')).toBe(true);
    expect(isThemeName('glass')).toBe(true);
    expect(isThemeName('glass-frost')).toBe(true);
    expect(isThemeName('glass-crystal')).toBe(true);
    expect(isThemeName('glass-smoke')).toBe(true);
  });

  it('accepts exactly the names the token file implements', () => {
    // The union, the token blocks and the boot script all read the same list;
    // this is the assertion that keeps a fifth glass variant from being half
    // added (AIS-169).
    expect([...THEME_NAMES]).toEqual([
      'light',
      'dark',
      'ambient',
      'glass',
      'glass-frost',
      'glass-crystal',
      'glass-smoke',
    ]);
  });

  it('rejects a name the token file does not implement', () => {
    expect(isThemeName('sepia')).toBe(false);
  });

  it('rejects a value of the wrong type', () => {
    expect(isThemeName(null)).toBe(false);
    expect(isThemeName(undefined)).toBe(false);
    expect(isThemeName(42)).toBe(false);
    expect(isThemeName({})).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isThemeName('')).toBe(false);
  });

  it('is case sensitive', () => {
    expect(isThemeName('DARK')).toBe(false);
  });
});

describe('readStoredTheme', () => {
  let storage: WebStorageHarness;

  beforeEach(() => {
    storage = installRecordingStorages();
  });

  afterEach(() => {
    storage.restore();
  });

  it('returns the default when the browser exposes no storage', () => {
    expect(readStoredTheme(null)).toBe(DEFAULT_THEME_NAME);
  });

  it('returns the default on a first visit', () => {
    expect(readStoredTheme(storage.local)).toBe(DEFAULT_THEME_NAME);
  });

  it('returns the stored appearance', () => {
    storage.local.setItem(THEME_STORAGE_KEY, 'ambient');

    expect(readStoredTheme(storage.local)).toBe('ambient');
  });

  it('returns the default when the stored value is not implemented', () => {
    storage.local.setItem(THEME_STORAGE_KEY, 'sepia');

    expect(readStoredTheme(storage.local)).toBe(DEFAULT_THEME_NAME);
  });

  it('returns the default when the storage throws on read', () => {
    expect(readStoredTheme(createBrokenStorage())).toBe(DEFAULT_THEME_NAME);
  });
});

describe('writeStoredTheme', () => {
  let storage: WebStorageHarness;

  beforeEach(() => {
    storage = installRecordingStorages();
  });

  afterEach(() => {
    storage.restore();
  });

  it('reports failure when the browser exposes no storage', () => {
    expect(writeStoredTheme(null, 'light')).toBe(false);
  });

  it('writes the appearance under the documented key', () => {
    expect(writeStoredTheme(storage.local, 'ambient')).toBe(true);
    expect(storage.local.writtenKeys()).toEqual([THEME_STORAGE_KEY]);
    expect(storage.local.getItem(THEME_STORAGE_KEY)).toBe('ambient');
  });

  it('leaves the session storage untouched', () => {
    writeStoredTheme(storage.local, 'light');

    expect(storage.session.isUntouched()).toBe(true);
  });

  it('reports failure when the storage throws on write', () => {
    expect(writeStoredTheme(createBrokenStorage(), 'light')).toBe(false);
  });
});
