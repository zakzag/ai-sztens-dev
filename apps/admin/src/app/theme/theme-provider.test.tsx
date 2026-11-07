/**
 * Tests of the theme provider (AIS-165).
 *
 * The provider's whole contract is observable in two places — the `data-theme`
 * attribute on `<html>` and the `localStorage` entry — so the suite asserts
 * exactly those, plus the one thing that must **not** happen: mounting the
 * provider never writes a preference.
 */

import { DEFAULT_THEME_NAME } from '@callback/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readDocumentTheme,
  resetDocumentTheme,
} from '../../test/mocks/document-theme.mock.js';
import { ThemeProbe } from '../../test/mocks/theme-provider.mock.js';
import {
  installRecordingStorages,
  installThrowingStorageAccess,
  type WebStorageHarness,
} from '../../test/mocks/web-storage.mock.js';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from './theme.const.js';
import { MissingThemeProviderError } from './theme.errors.js';
import { ThemeProvider } from './theme-provider.js';

describe('ThemeProvider', () => {
  let storage: WebStorageHarness;

  beforeEach(() => {
    resetDocumentTheme();
    storage = installRecordingStorages();
  });

  afterEach(() => {
    storage.restore();
    resetDocumentTheme();
  });

  it('applies the default appearance without persisting anything', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(readDocumentTheme()).toBe(DEFAULT_THEME_NAME);
    expect(screen.getByTestId('theme')).toHaveTextContent(DEFAULT_THEME_NAME);
    expect(storage.local.isUntouched()).toBe(true);
  });

  it('applies the stored appearance on mount', () => {
    storage.local.setItem(THEME_STORAGE_KEY, 'ambient');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(readDocumentTheme()).toBe('ambient');
    expect(screen.getByTestId('theme')).toHaveTextContent('ambient');
  });

  it('falls back to the default when the stored appearance is unknown', () => {
    storage.local.setItem(THEME_STORAGE_KEY, 'sepia');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(readDocumentTheme()).toBe(DEFAULT_THEME_NAME);
  });

  it('repaints the document and persists the chosen appearance', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeProbe target="light" />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'apply theme' }));

    expect(readDocumentTheme()).toBe('light');
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(storage.local.writtenKeys()).toEqual([THEME_STORAGE_KEY]);
    expect(storage.local.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('still applies the appearance when the storage is unreachable', async () => {
    storage.restore();
    const restoreAccess = installThrowingStorageAccess();
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeProbe target="ambient" />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'apply theme' }));

    expect(readDocumentTheme()).toBe('ambient');

    restoreAccess();
  });

  it('writes the attribute the token blocks switch on', async () => {
    render(
      <ThemeProvider>
        <ThemeProbe target="light" />
      </ThemeProvider>,
    );

    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(true);
  });
});

describe('useTheme', () => {
  it('fails loudly outside the provider', () => {
    // A silent default would look like "the selector does nothing" — the exact
    // defect AIS-165 removes — so the hook must throw instead.
    expect(() => render(<ThemeProbe />)).toThrow(MissingThemeProviderError);
  });
});
