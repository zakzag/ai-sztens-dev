import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Input } from '../src/components/input/Input.js';

describe('Input', () => {
  it('associates the label with the input', () => {
    render(<Input id="name" label="Név" />);

    expect(screen.getByLabelText('Név')).toHaveAttribute('id', 'name');
  });

  it('accepts typed input', async () => {
    render(<Input id="name" label="Név" />);

    await userEvent.type(screen.getByLabelText('Név'), 'Hívás');

    expect(screen.getByLabelText('Név')).toHaveValue('Hívás');
  });

  it('renders the hint and links it through aria-describedby', () => {
    render(<Input id="name" label="Név" hint="Legfeljebb 200 karakter" />);

    const input = screen.getByLabelText('Név');

    expect(input).toHaveAttribute('aria-describedby', 'name-hint');
    expect(screen.getByText('Legfeljebb 200 karakter')).toHaveAttribute('id', 'name-hint');
  });

  it('marks the input invalid and shows the error instead of the hint', () => {
    render(<Input id="name" label="Név" hint="Súgó" error="Kötelező mező" />);

    const input = screen.getByLabelText('Név');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'name-error');
    expect(input.className).toContain('border-danger');
    expect(screen.getByText('Kötelező mező')).toHaveAttribute('id', 'name-error');
    expect(screen.queryByText('Súgó')).not.toBeInTheDocument();
  });

  it('omits aria attributes when there is neither hint nor error', () => {
    render(<Input id="name" label="Név" />);

    const input = screen.getByLabelText('Név');

    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('renders the invalid recipe when invalid is set without a message', () => {
    render(<Input id="name" label="Név" invalid />);

    expect(screen.getByLabelText('Név').className).toContain('border-danger');
  });

  it('forwards native input attributes', () => {
    render(<Input id="name" label="Név" type="email" placeholder="pelda@ceg.hu" disabled />);

    const input = screen.getByLabelText('Név');

    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('placeholder', 'pelda@ceg.hu');
    expect(input).toBeDisabled();
  });
});
