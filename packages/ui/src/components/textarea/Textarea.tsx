import { forwardRef } from 'react';
import type { TextareaProps } from './textarea.interface.js';
import { textareaVariants } from './textarea.variants.js';
import { cn } from '../../lib/cn.js';

/**
 * Labelled multi-line text field with optional hint and field-level error.
 *
 * Accessibility wiring matches {@link Input}: the label points at the field, the
 * field carries `aria-invalid` when invalid, and `aria-describedby` points at
 * whichever message is actually rendered.
 *
 * The ref is forwarded because react-hook-form needs it to focus the first
 * invalid field on a failed submit.
 *
 * @param props - see {@link TextareaProps}.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ id, label, error, hint, invalid, className, rows = 4, ...rest }, ref) {
    const hasError = Boolean(error);
    const messageId = hasError ? `${id}-error` : hint ? `${id}-hint` : undefined;

    return (
      <div className="space-y-1">
        <label htmlFor={id} className="block text-sm font-medium text-text-secondary">
          {label}
        </label>
        <textarea
          {...rest}
          ref={ref}
          id={id}
          rows={rows}
          className={cn(textareaVariants({ invalid: hasError || Boolean(invalid) }), className)}
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
  },
);
