import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Select } from '../src/components/select/Select.js';
import { FORM_OPTIONS } from './mocks/form-options.mock.js';

describe('Select', () => {
  it('renders every option in order', () => {
    render(<Select id="role" options={FORM_OPTIONS} />);

    const options = screen.getAllByRole('option');

    expect(options).toHaveLength(FORM_OPTIONS.length);
    expect(options[0]).toHaveTextContent('Tulajdonos');
    expect(options[2]).toHaveTextContent('Megtekintő');
  });

  it('renders a disabled placeholder option first', () => {
    render(
      <Select
        id="role"
        options={FORM_OPTIONS}
        placeholder="Válassz szerepet"
      />,
    );

    const placeholder = screen.getByRole('option', {
      name: 'Válassz szerepet',
    });

    expect(placeholder).toBeDisabled();
    expect(placeholder).toHaveValue('');
  });

  it('fires onChange with the selected value', async () => {
    const onChange = vi.fn();

    render(<Select id="role" options={FORM_OPTIONS} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'admin');

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('marks the field invalid and colours the border', () => {
    render(<Select id="role" options={FORM_OPTIONS} invalid />);

    const select = screen.getByRole('combobox');

    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select.className).toContain('border-danger');
  });

  it('links the message paragraph through aria-describedby', () => {
    render(
      <Select
        id="role"
        options={FORM_OPTIONS}
        invalid
        describedBy="role-error"
      />,
    );

    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-describedby',
      'role-error',
    );
  });

  it('renders disabled when disabled is set', () => {
    render(<Select id="role" options={FORM_OPTIONS} disabled />);

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('renders a disabled option as disabled', () => {
    render(<Select id="role" options={FORM_OPTIONS} />);

    expect(
      screen.getByRole('option', { name: 'Adminisztrátor' }),
    ).toBeEnabled();
  });
});
