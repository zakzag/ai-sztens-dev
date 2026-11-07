/**
 * Tests of the appearance selector.
 *
 * The component is a **purely controlled** select box (AIS-149, AIS-167): it
 * renders the value it is given and reports a pick. The suite covers the compact
 * contract — closed it shows **only** the chosen appearance with its icon, open
 * it lists the four appearances — and the negative contract: the control itself
 * touches neither the document nor the storage. The wiring (attribute +
 * persistence) is asserted once, on `AdminLayout`.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOverlayUser } from '../../../test/mocks/overlay-environment.mock.js';
import { ThemeSelectorHarness } from '../../../test/mocks/theme-selector-harness.mock.js';
import {
  installRecordingStorages,
  type WebStorageHarness,
} from '../../../test/mocks/web-storage.mock.js';
import {
  THEME_OPTION_AMBIENT_LABEL,
  THEME_OPTION_DARK_LABEL,
  THEME_OPTION_GLASS,
  THEME_OPTION_GLASS_LABEL,
  THEME_OPTION_LIGHT_LABEL,
  THEME_SELECTOR_LABEL,
} from '../layout.const.js';

/**
 * Renders the selector with a stateful owner and a fresh change spy.
 *
 * @returns the render result plus the `onChange` spy.
 */
function renderSelector() {
  const onChange = vi.fn();
  const result = render(<ThemeSelectorHarness onChange={onChange} />);

  return { ...result, onChange };
}

/**
 * Builds the accessible name the trigger reports.
 *
 * @param chosenLabel - label of the appearance the trigger shows.
 * @returns `"Megjelenés: <chosen label>"`.
 */
function toTriggerName(chosenLabel: string): string {
  return `${THEME_SELECTOR_LABEL}: ${chosenLabel}`;
}

describe('ThemeSelector', () => {
  /**
   * Recording doubles of both web storages, reinstalled per test.
   *
   * The negative contract ("no storage write") is asserted on these counters
   * instead of on `window.localStorage.length`: jsdom does not always provide a
   * storage object, and reading `.length` of a missing one crashes the test
   * instead of failing it.
   */
  let storage: WebStorageHarness;

  beforeEach(() => {
    storage = installRecordingStorages();
  });

  afterEach(() => {
    storage.restore();
    document.documentElement.removeAttribute('data-theme');
  });

  it('closes into a select box that shows only the chosen appearance', () => {
    const { container } = renderSelector();

    expect(
      screen.getByRole('button', {
        name: toTriggerName(THEME_OPTION_DARK_LABEL),
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // The chosen appearance's icon plus the trigger chevron — nothing else.
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(
      screen.queryByText(THEME_OPTION_LIGHT_LABEL),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(THEME_OPTION_AMBIENT_LABEL),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(THEME_OPTION_GLASS_LABEL),
    ).not.toBeInTheDocument();
  });

  it('offers no search field, unlike a combobox', () => {
    renderSelector();

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('lists the four appearances with an icon each and marks the current one', async () => {
    const user = createOverlayUser();

    renderSelector();

    await user.click(
      screen.getByRole('button', {
        name: toTriggerName(THEME_OPTION_DARK_LABEL),
      }),
    );

    const menu = await screen.findByRole('menu');

    expect(menu).toHaveAttribute('aria-label', THEME_SELECTOR_LABEL);

    const options = screen.getAllByRole('menuitemradio');

    expect(options.map((option) => option.textContent)).toEqual([
      THEME_OPTION_LIGHT_LABEL,
      THEME_OPTION_DARK_LABEL,
      THEME_OPTION_AMBIENT_LABEL,
      THEME_OPTION_GLASS_LABEL,
    ]);
    expect(
      options.every((option) => option.querySelector('svg') !== null),
    ).toBe(true);
    expect(options[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('moves the selection, closes, and shows the new appearance', async () => {
    const user = createOverlayUser();
    const { onChange } = renderSelector();

    await user.click(
      screen.getByRole('button', {
        name: toTriggerName(THEME_OPTION_DARK_LABEL),
      }),
    );
    await screen.findByRole('menu');
    await user.click(
      screen.getByRole('menuitemradio', { name: THEME_OPTION_LIGHT_LABEL }),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('light');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', {
        name: toTriggerName(THEME_OPTION_LIGHT_LABEL),
      }),
    ).toBeInTheDocument();
  });

  it('reports the glass appearance as the token union value', async () => {
    const user = createOverlayUser();
    const { onChange } = renderSelector();

    await user.click(
      screen.getByRole('button', {
        name: toTriggerName(THEME_OPTION_DARK_LABEL),
      }),
    );
    await screen.findByRole('menu');
    await user.click(
      screen.getByRole('menuitemradio', { name: THEME_OPTION_GLASS_LABEL }),
    );

    expect(onChange).toHaveBeenCalledWith(THEME_OPTION_GLASS);
    expect(onChange).toHaveBeenCalledWith('glass');
  });

  it('touches neither the document nor the storage', async () => {
    const user = createOverlayUser();

    renderSelector();

    await user.click(
      screen.getByRole('button', {
        name: toTriggerName(THEME_OPTION_DARK_LABEL),
      }),
    );
    await screen.findByRole('menu');
    await user.click(
      screen.getByRole('menuitemradio', { name: THEME_OPTION_AMBIENT_LABEL }),
    );

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(document.documentElement.getAttribute('style')).toBeNull();
    expect(document.body.hasAttribute('data-theme')).toBe(false);
    expect(storage.local.writtenKeys()).toEqual([]);
    expect(storage.local.isUntouched()).toBe(true);
    expect(storage.session.writtenKeys()).toEqual([]);
    expect(storage.session.isUntouched()).toBe(true);
  });
});
