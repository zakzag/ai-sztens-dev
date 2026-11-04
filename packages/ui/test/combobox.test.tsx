import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Combobox } from '../src/components/combobox/Combobox.js';
import { ComboboxHarness } from './mocks/combobox-harness.mock.js';
import { FORM_COMBOBOX_OPTIONS } from './mocks/form-options.mock.js';

describe('Combobox', () => {
  it('renders a collapsed combobox with no listbox', () => {
    render(<ComboboxHarness options={FORM_COMBOBOX_OPTIONS} />);

    const input = screen.getByRole('combobox');

    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens the listbox on focus', async () => {
    render(<ComboboxHarness options={FORM_COMBOBOX_OPTIONS} />);

    await userEvent.click(screen.getByRole('combobox'));

    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('filters the options without accents', async () => {
    render(<ComboboxHarness options={FORM_COMBOBOX_OPTIONS} />);

    await userEvent.type(screen.getByRole('combobox'), 'attek');

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('Áttekintő');
  });

  it('shows the empty message when nothing matches', async () => {
    render(<ComboboxHarness options={FORM_COMBOBOX_OPTIONS} />);

    await userEvent.type(screen.getByRole('combobox'), 'zzz');

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('Nincs találat')).toBeInTheDocument();
  });

  it('marks the highlighted option with aria-activedescendant', async () => {
    render(<ComboboxHarness options={FORM_COMBOBOX_OPTIONS} />);

    const input = screen.getByRole('combobox');

    input.focus();
    await userEvent.keyboard('{ArrowDown}');

    expect(input).toHaveAttribute(
      'aria-activedescendant',
      'role-listbox-option-0',
    );
  });

  it('selects the highlighted option with Enter', async () => {
    const onSelect = vi.fn();

    render(
      <ComboboxHarness options={FORM_COMBOBOX_OPTIONS} onSelect={onSelect} />,
    );

    const input = screen.getByRole('combobox');

    input.focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('owner');
    expect(screen.getByTestId('selected-value')).toHaveTextContent('owner');
    expect(input).toHaveValue('Tulajdonos');
  });

  it('closes the listbox on Escape', async () => {
    render(<ComboboxHarness options={FORM_COMBOBOX_OPTIONS} />);

    const input = screen.getByRole('combobox');

    input.focus();
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not select a disabled option', async () => {
    const onSelect = vi.fn();

    render(
      <ComboboxHarness options={FORM_COMBOBOX_OPTIONS} onSelect={onSelect} />,
    );

    await userEvent.click(screen.getByRole('combobox'));
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Adminisztrátor' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId('selected-value')).toHaveTextContent('nincs');
  });

  it('renders disabled when disabled is set', () => {
    render(<ComboboxHarness options={FORM_COMBOBOX_OPTIONS} disabled />);

    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
