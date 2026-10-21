import { forwardRef } from 'react';
import type { InputProps } from './input.interface.js';
import { inputVariants } from './input.variants.js';
import { cn } from '../../lib/cn.js';

/**
 * Labelled text input with optional hint and field-level error.
 *
 * Accessibility wiring: the label points at the input, the input carries
 * `aria-invalid` when invalid, and `aria-describedby` points at whichever
 * message is actually rendered.
 *
 * The ref is forwarded because react-hook-form needs it to focus the first
 * invalid field on a failed submit.
 *
 * @param props - see {@link InputProps}.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, error, hint, invalid, className, ...rest },
  ref,
) {
  const hasError = Boolean(error);
  const messageId = hasError ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-text-secondary">
        {label}
      </label>
      <input
        {...rest}
        ref={ref}
        id={id}
        className={cn(inputVariants({ invalid: hasError || Boolean(invalid) }), className)}
        aria-invalid={hasError || undefined}
        aria-describedby={messageId}
      />
      {hasError ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
