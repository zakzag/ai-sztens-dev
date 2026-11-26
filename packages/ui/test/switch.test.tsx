import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from '../src/components/switch/Switch.js';

describe('Switch', () => {
  it('exposes the switch role with the label as accessible name', () => {
    render(<Switch id="notify" label="Értesítés" />);

    expect(
      screen.getByRole('switch', { name: 'Értesítés' }),
    ).toBeInTheDocument();
  });

  it('reflects the controlled checked state in aria-checked', () => {
    render(<Switch id="notify" label="Értesítés" checked />);

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('reflects an unchecked controlled state', () => {
    render(<Switch id="notify" label="Értesítés" checked={false} />);

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles with the keyboard', async () => {
    const onChange = vi.fn();

    render(<Switch id="notify" label="Értesítés" onChange={onChange} />);

    const input = screen.getByRole('switch');

    input.focus();
    await userEvent.keyboard(' ');

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders the description inside the label', () => {
    render(
      <Switch
        id="notify"
        label="Értesítés"
        description="E-mailt küld minden hívás után"
      />,
    );

    expect(
      screen.getByText('E-mailt küld minden hívás után'),
    ).toBeInTheDocument();
  });

  it('links the message paragraph through aria-describedby', () => {
    render(<Switch id="notify" label="Értesítés" describedBy="notify-error" />);

    expect(screen.getByRole('switch')).toHaveAttribute(
      'aria-describedby',
      'notify-error',
    );
  });

  it('renders disabled when disabled is set', () => {
    render(<Switch id="notify" label="Értesítés" disabled />);

    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
