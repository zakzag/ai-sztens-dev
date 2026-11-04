import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from '../src/components/form-field/FormField.js';
import { NumberInput } from '../src/components/number-input/NumberInput.js';

describe('FormField', () => {
  it('points the label at the control id', () => {
    render(
      <FormField id="amount" label="Összeg">
        {(field) => <NumberInput id={field.id} invalid={field.invalid} />}
      </FormField>,
    );

    expect(screen.getByLabelText('Összeg')).toHaveAttribute('id', 'amount');
  });

  it('links the hint through aria-describedby', () => {
    render(
      <FormField id="amount" label="Összeg" hint="Forintban">
        {(field) => (
          <NumberInput
            id={field.id}
            invalid={field.invalid}
            describedBy={field.describedBy}
          />
        )}
      </FormField>,
    );

    const control = screen.getByLabelText('Összeg');

    expect(control).toHaveAttribute('aria-describedby', 'amount-hint');
    expect(screen.getByText('Forintban')).toHaveAttribute('id', 'amount-hint');
  });

  it('marks the control invalid and shows the error instead of the hint', () => {
    render(
      <FormField
        id="amount"
        label="Összeg"
        hint="Forintban"
        error="Kötelező mező"
      >
        {(field) => (
          <NumberInput
            id={field.id}
            invalid={field.invalid}
            describedBy={field.describedBy}
          />
        )}
      </FormField>,
    );

    const control = screen.getByLabelText('Összeg');

    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAttribute('aria-describedby', 'amount-error');
    expect(screen.getByText('Kötelező mező')).toHaveAttribute(
      'id',
      'amount-error',
    );
    expect(screen.queryByText('Forintban')).not.toBeInTheDocument();
  });

  it('spreads DOM-safe aria attributes onto a raw control', () => {
    render(
      <FormField id="name" label="Név" error="Kötelező">
        {(field) => <input {...field.ariaProps} />}
      </FormField>,
    );

    const control = screen.getByLabelText('Név');

    expect(control).toHaveAttribute('id', 'name');
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAttribute('aria-describedby', 'name-error');
  });

  it('omits aria attributes when there is neither hint nor error', () => {
    render(
      <FormField id="amount" label="Összeg">
        {(field) => <NumberInput {...field.ariaProps} />}
      </FormField>,
    );

    const control = screen.getByLabelText('Összeg');

    expect(control).not.toHaveAttribute('aria-invalid');
    expect(control).not.toHaveAttribute('aria-describedby');
  });

  it('announces the required marker to screen readers', () => {
    render(
      <FormField id="amount" label="Összeg" required>
        {(field) => <NumberInput {...field.ariaProps} />}
      </FormField>,
    );

    expect(screen.getByText('(kötelező)')).toBeInTheDocument();
  });

  it('never renders the plain invalid flag as a DOM attribute', () => {
    render(
      <FormField id="amount" label="Összeg" error="Hibás">
        {(field) => <NumberInput {...field.ariaProps} />}
      </FormField>,
    );

    expect(screen.getByLabelText('Összeg')).not.toHaveAttribute('invalid');
  });
});
