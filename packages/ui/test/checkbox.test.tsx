import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from '../src/components/checkbox/Checkbox.js';

describe('Checkbox', () => {
  it('associates the label with the checkbox', () => {
    render(<Checkbox id="active" label="Aktív" />);

    expect(screen.getByLabelText('Aktív')).toHaveAttribute('id', 'active');
  });

  it('toggles on click', async () => {
    render(<Checkbox id="active" label="Aktív" />);

    const checkbox = screen.getByLabelText('Aktív');

    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();
  });

  it('toggles with the keyboard', async () => {
    render(<Checkbox id="active" label="Aktív" />);

    const checkbox = screen.getByLabelText('Aktív');

    checkbox.focus();
    await userEvent.keyboard(' ');

    expect(checkbox).toBeChecked();
  });

  it('renders the description inside the label', () => {
    render(
      <Checkbox
        id="active"
        label="Aktív"
        description="Az inaktív kulcs nem hívható"
      />,
    );

    expect(
      screen.getByText('Az inaktív kulcs nem hívható'),
    ).toBeInTheDocument();
  });

  it('marks the field invalid and colours the border', () => {
    render(
      <Checkbox id="active" label="Aktív" invalid describedBy="active-error" />,
    );

    const checkbox = screen.getByLabelText('Aktív');

    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    expect(checkbox).toHaveAttribute('aria-describedby', 'active-error');
    expect(checkbox.className).toContain('border-danger');
  });

  it('reports the new state through onChange', async () => {
    const onChange = vi.fn();

    render(<Checkbox id="active" label="Aktív" onChange={onChange} />);

    await userEvent.click(screen.getByLabelText('Aktív'));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders disabled when disabled is set', () => {
    render(<Checkbox id="active" label="Aktív" disabled />);

    expect(screen.getByLabelText('Aktív')).toBeDisabled();
  });
});
