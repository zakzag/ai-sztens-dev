import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormActions } from '../src/components/form-actions/FormActions.js';

describe('FormActions', () => {
  it('renders a submit button by default', () => {
    render(<FormActions />);

    expect(screen.getByRole('button', { name: 'Mentés' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('marks the submit button busy and disabled while submitting', () => {
    render(<FormActions isSubmitting submitLabel="Küldés" />);

    const submit = screen.getByRole('button', { name: /Küldés/ });

    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();

    render(<FormActions onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Mégsem' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders no cancel button without a handler', () => {
    render(<FormActions />);

    expect(
      screen.queryByRole('button', { name: 'Mégsem' }),
    ).not.toBeInTheDocument();
  });

  it('disables the cancel button while submitting', () => {
    render(<FormActions onCancel={vi.fn()} isSubmitting />);

    expect(screen.getByRole('button', { name: 'Mégsem' })).toBeDisabled();
  });

  it('uses the custom labels when provided', () => {
    render(
      <FormActions
        submitLabel="Létrehozás"
        cancelLabel="Elvetés"
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /Létrehozás/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elvetés' })).toBeInTheDocument();
  });
});
