import { forwardRef } from 'react';
import { checkboxVariants } from './checkbox.variants.js';
import { cn } from '../../lib/cn.js';
import type { CheckboxProps } from './checkbox.interface.js';

/**
 * Checkbox with its label and optional explanation in one component.
 *
 * The native input stays visible (not visually hidden) so the focus ring and the
 * platform hit area are preserved, and the whole label block is clickable.
 * Ref forwarding lets a form focus the first invalid field.
 *
 * @param props - see {@link CheckboxProps}.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    { id, label, description, invalid = false, describedBy, ...rest },
    ref,
  ) {
    return (
      <div className="flex items-start gap-2">
        <input
          {...rest}
          ref={ref}
          id={id}
          type="checkbox"
          className={cn(checkboxVariants({ invalid }))}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
        <label htmlFor={id} className="text-sm text-text-secondary">
          {label}
          {description ? (
            <span className="block text-xs text-text-muted">{description}</span>
          ) : null}
        </label>
      </div>
    );
  },
);
