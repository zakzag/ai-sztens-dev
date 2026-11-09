/**
 * Tests of the `SelectMenu` primitive (AIS-149).
 *
 * The control is fully controlled, so the harness supplies the state. The suite
 * covers the compact contract (closed it shows one option and its icon), the
 * single-choice semantics (`menuitemradio` + `aria-checked`), and that a pick
 * comes back as a value and updates the trigger.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  SELECT_MENU_LABEL,
  SELECT_MENU_OPTIONS,
  SELECT_MENU_OPTIONS_WITH_DISABLED,
  SelectMenuHarness,
} from './mocks/select-menu.mock.js';
import { createOverlayUser } from './mocks/overlay-user.mock.js';

/** Accessible name the trigger builds from the label and the chosen option. */
function toTriggerName(chosenLabel: string): string {
  return `${SELECT_MENU_LABEL}: ${chosenLabel}`;
}

describe('SelectMenu', () => {
  it('renders one closed trigger with the chosen option and its icon', () => {
    const { container } = render(
      <SelectMenuHarness options={SELECT_MENU_OPTIONS} initialValue="dark" />,
    );

    expect(
      screen.getByRole('button', { name: toTriggerName('Sötét') }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // The chosen icon and the chevron, nothing else.
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(screen.queryByText('Világos')).not.toBeInTheDocument();
  });

  it('has no text input, so there is nothing to search in', () => {
    render(
      <SelectMenuHarness options={SELECT_MENU_OPTIONS} initialValue="dark" />,
    );

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('opens a named single-choice panel with one icon per option', async () => {
    const user = createOverlayUser();
    render(
      <SelectMenuHarness options={SELECT_MENU_OPTIONS} initialValue="dark" />,
    );

    await user.click(
      screen.getByRole('button', { name: toTriggerName('Sötét') }),
    );

    const menu = await screen.findByRole('menu');

    expect(menu).toHaveAttribute('aria-label', SELECT_MENU_LABEL);

    const options = screen.getAllByRole('menuitemradio');

    expect(options.map((option) => option.textContent)).toEqual([
      'Világos',
      'Sötét',
      'Ambient',
    ]);
    expect(
      options.every((option) => option.querySelector('svg') !== null),
    ).toBe(true);
    expect(options[1]).toHaveAttribute('aria-checked', 'true');
    expect(options[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('reports the picked value and shows it on the trigger', async () => {
    const onValueChange = vi.fn();
    const user = createOverlayUser();
    render(
      <SelectMenuHarness
        options={SELECT_MENU_OPTIONS}
        initialValue="dark"
        onValueChange={onValueChange}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: toTriggerName('Sötét') }),
    );
    await screen.findByRole('menu');
    await user.click(screen.getByRole('menuitemradio', { name: 'Világos' }));

    expect(onValueChange).toHaveBeenCalledWith('light');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: toTriggerName('Világos') }),
    ).toBeInTheDocument();
  });

  it('selects with the keyboard', async () => {
    const onValueChange = vi.fn();
    const user = createOverlayUser();
    render(
      <SelectMenuHarness
        options={SELECT_MENU_OPTIONS}
        initialValue="dark"
        onValueChange={onValueChange}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: toTriggerName('Sötét'),
    });

    trigger.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    // The collection starts on the first option, so two steps reach the last.
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onValueChange).toHaveBeenCalledWith('ambient');
  });

  it('never picks a disabled option', async () => {
    const onValueChange = vi.fn();
    const user = createOverlayUser();
    render(
      <SelectMenuHarness
        options={SELECT_MENU_OPTIONS_WITH_DISABLED}
        initialValue="dark"
        onValueChange={onValueChange}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: toTriggerName('Sötét') }),
    );
    await screen.findByRole('menu');

    const disabled = screen.getByRole('menuitemradio', { name: 'Ambient' });

    expect(disabled).toHaveAttribute('data-disabled');

    await user.click(disabled);

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('falls back to the plain label when the value is not in the list', () => {
    render(
      <SelectMenuHarness options={SELECT_MENU_OPTIONS} initialValue="sepia" />,
    );

    expect(
      screen.getByRole('button', { name: SELECT_MENU_LABEL }),
    ).toBeInTheDocument();
  });
});
