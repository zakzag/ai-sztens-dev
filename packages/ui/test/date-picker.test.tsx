import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from '../src/components/date-picker/DatePicker.js';

/**
 * The native date input has no stable ARIA role in jsdom, so the tests resolve
 * it through the container rather than pretending it is a textbox.
 */
function getDateInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input');

  if (!(input instanceof HTMLInputElement)) {
    throw new Error('DatePicker did not render an input element');
  }

  return input;
}

describe('DatePicker', () => {
  it('renders the value as yyyy-mm-dd', () => {
    const { container } = render(
      <DatePicker id="due" value="2026-11-04" onChange={vi.fn()} />,
    );

    const input = getDateInput(container);

    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveValue('2026-11-04');
  });

  it('reports a new value as the same string format', () => {
    const onChange = vi.fn();
    const { container } = render(
      <DatePicker id="due" value="" onChange={onChange} />,
    );

    fireEvent.change(getDateInput(container), {
      target: { value: '2026-11-04' },
    });

    expect(onChange).toHaveBeenCalledWith('2026-11-04');
  });

  it('forwards min and max', () => {
    const { container } = render(
      <DatePicker
        id="due"
        value=""
        min="2026-01-01"
        max="2026-12-31"
        onChange={vi.fn()}
      />,
    );

    const input = getDateInput(container);

    expect(input).toHaveAttribute('min', '2026-01-01');
    expect(input).toHaveAttribute('max', '2026-12-31');
  });

  it('marks the field invalid and colours the border', () => {
    const { container } = render(
      <DatePicker
        id="due"
        value=""
        onChange={vi.fn()}
        invalid
        describedBy="due-error"
      />,
    );

    const input = getDateInput(container);

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'due-error');
    expect(input.className).toContain('border-danger');
  });

  it('omits aria attributes when not invalid', () => {
    const { container } = render(
      <DatePicker id="due" value="" onChange={vi.fn()} />,
    );

    const input = getDateInput(container);

    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('renders disabled when disabled is set', () => {
    const { container } = render(
      <DatePicker id="due" value="" onChange={vi.fn()} disabled />,
    );

    expect(getDateInput(container)).toBeDisabled();
  });
});
