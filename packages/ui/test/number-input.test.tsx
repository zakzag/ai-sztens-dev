import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { NumberInput } from '../src/components/number-input/NumberInput.js';

describe('NumberInput', () => {
  it('renders a numeric input with the forwarded min/max/step', () => {
    render(<NumberInput id="amount" min={1} max={10} step={2} />);

    const input = screen.getByRole('spinbutton');

    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '10');
    expect(input).toHaveAttribute('step', '2');
  });

  it('accepts typed digits', async () => {
    render(<NumberInput id="amount" />);

    await userEvent.type(screen.getByRole('spinbutton'), '42');

    expect(screen.getByRole('spinbutton')).toHaveValue(42);
  });

  it('marks the field invalid and colours the border', () => {
    render(<NumberInput id="amount" invalid describedBy="amount-error" />);

    const input = screen.getByRole('spinbutton');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'amount-error');
    expect(input.className).toContain('border-danger');
  });

  it('omits aria attributes when not invalid', () => {
    render(<NumberInput id="amount" />);

    const input = screen.getByRole('spinbutton');

    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('renders disabled when disabled is set', () => {
    render(<NumberInput id="amount" disabled />);

    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });
});
