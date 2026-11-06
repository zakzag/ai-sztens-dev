/**
 * Tests of the appearance selector.
 *
 * The component is a controlled-by-nobody **combobox** (AIS-148): it owns its
 * selection locally and reports every change through the `onThemeChange` port.
 * The suite covers the compact contract — closed it shows **only** the chosen
 * appearance, open it lists all three — the filter-text reset, and the negative
 * contract: selecting an appearance changes **nothing** outside the component
 * (AIS-140 `D3`).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

describe('ThemeSelector', () => {
  it('closes into a single, labelled combobox that shows only the selection', () => {
    const { container } = renderSelector();

    const input = screen.getByRole('combobox', { name: THEME_SELECTOR_LABEL });

    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue(THEME_OPTION_DARK_LABEL);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });

  it('opens the three appearances on focus and marks the selected one', async () => {
    renderSelector();

    const input = screen.getByRole('combobox', { name: THEME_SELECTOR_LABEL });

    await userEvent.click(input);

    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual([
      THEME_OPTION_LIGHT_LABEL,
      THEME_OPTION_DARK_LABEL,
      THEME_OPTION_AMBIENT_LABEL,
    ]);
    expect(
      screen.getByRole('option', { name: THEME_OPTION_DARK_LABEL }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('commits a new appearance, closes, and shows it as the only value', async () => {
    const { onThemeChange } = renderSelector();

    const input = screen.getByRole('combobox', { name: THEME_SELECTOR_LABEL });

    await userEvent.click(input);
    await userEvent.click(
      screen.getByRole('option', { name: THEME_OPTION_LIGHT_LABEL }),
    );

    expect(input).toHaveValue(THEME_OPTION_LIGHT_LABEL);
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onThemeChange).toHaveBeenCalledTimes(1);
    expect(onThemeChange).toHaveBeenCalledWith(THEME_OPTION_LIGHT);
  });

  it('filters the list without accents', async () => {
    renderSelector();

    const input = screen.getByRole('combobox', { name: THEME_SELECTOR_LABEL });

    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, 'vilag');

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent(
      THEME_OPTION_LIGHT_LABEL,
    );
  });

  it('drops the typed filter text when the listbox closes', async () => {
    renderSelector();

    const input = screen.getByRole('combobox', { name: THEME_SELECTOR_LABEL });

    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, 'zzz');

    expect(screen.queryAllByRole('option')).toHaveLength(0);

    await userEvent.keyboard('{Escape}');

    expect(input).toHaveValue(THEME_OPTION_DARK_LABEL);
  });

  it('keeps the committed appearance when the filter matched nothing', async () => {
    const { onThemeChange } = renderSelector();

    const input = screen.getByRole('combobox', { name: THEME_SELECTOR_LABEL });

    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, 'zzz');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(input);

    expect(
      screen.getByRole('option', { name: THEME_OPTION_DARK_LABEL }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(onThemeChange).not.toHaveBeenCalled();
  });

  it('touches neither the document nor the storage', async () => {
    renderSelector();

    const input = screen.getByRole('combobox', { name: THEME_SELECTOR_LABEL });

    await userEvent.click(input);
    await userEvent.click(
      screen.getByRole('option', { name: THEME_OPTION_AMBIENT_LABEL }),
    );

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(document.documentElement.getAttribute('style')).toBeNull();
    expect(document.body.hasAttribute('data-theme')).toBe(false);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
