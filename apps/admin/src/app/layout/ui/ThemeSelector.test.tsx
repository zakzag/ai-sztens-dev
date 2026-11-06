/**
 * Tests of the appearance selector.
 *
 * The component is a controlled-by-nobody **select box** (AIS-149): it owns its
 * selection locally and reports every change through the `onThemeChange` port.
 * The suite covers the compact contract — closed it shows **only** the chosen
 * appearance with its icon, open it lists all three — and the negative
 * contract: selecting an appearance changes **nothing** outside the component
 * (AIS-140 `D3`).
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createOverlayUser } from '../../../test/mocks/overlay-environment.mock.js';
import {
  THEME_OPTION_AMBIENT_LABEL,
  THEME_OPTION_DARK_LABEL,
  THEME_OPTION_LIGHT,
  THEME_OPTION_LIGHT_LABEL,
  THEME_SELECTOR_LABEL,
} from '../layout.const.js';
import { ThemeSelector } from './ThemeSelector.js';

/**
 * Renders the selector with a fresh port spy.
 *
 * @returns the render result plus the `onThemeChange` spy.
 */
function renderSelector() {
  const onThemeChange = vi.fn();
  const result = render(<ThemeSelector onThemeChange={onThemeChange} />);

  return { ...result, onThemeChange };
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
  });

  it('offers no search field, unlike a combobox', () => {
    renderSelector();

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('lists the three appearances with an icon each and marks the current one', async () => {
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
    ]);
    expect(
      options.every((option) => option.querySelector('svg') !== null),
    ).toBe(true);
    expect(options[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('moves the selection, closes, and shows the new appearance', async () => {
    const user = createOverlayUser();
    const { onThemeChange } = renderSelector();

    await user.click(
      screen.getByRole('button', {
        name: toTriggerName(THEME_OPTION_DARK_LABEL),
      }),
    );
    await screen.findByRole('menu');
    await user.click(
      screen.getByRole('menuitemradio', { name: THEME_OPTION_LIGHT_LABEL }),
    );

    expect(onThemeChange).toHaveBeenCalledTimes(1);
    expect(onThemeChange).toHaveBeenCalledWith(THEME_OPTION_LIGHT);
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', {
        name: toTriggerName(THEME_OPTION_LIGHT_LABEL),
      }),
    ).toBeInTheDocument();
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
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
