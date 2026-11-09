import { forwardRef } from 'react';
import { inputVariants } from '../input/input.variants.js';
import { cn } from '../../lib/cn.js';
import type { NumberInputProps } from './number-input.interface.js';

/**
 * Numeric input in the shared sunken control recipe.
 *
 * A native `input[type="number"]` keeps the browser's stepper, `min`/`max`/`step`
 * validation and mobile numeric keyboard. The ref is forwarded so a form can
 * focus the first invalid field.
 *
 * @param props - see {@link NumberInputProps}.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    { id, invalid = false, describedBy, className, ...rest },
    ref,
  ) {
    return (
      <input
        {...rest}
        ref={ref}
        id={id}
        type="number"
        className={cn(inputVariants({ invalid }), className)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
    );
  },
);
