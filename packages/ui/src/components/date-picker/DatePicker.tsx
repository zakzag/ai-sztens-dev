import { forwardRef } from 'react';
import { inputVariants } from '../input/input.variants.js';
import { cn } from '../../lib/cn.js';
import type { DatePickerProps } from './date-picker.interface.js';

/**
 * Date field in the shared sunken control recipe.
 *
 * A thin, controlled wrapper over the native `input[type="date"]`: the browser
 * supplies the calendar popup and the keyboard editing, we only supply the
 * tokens and the `yyyy-mm-dd` string contract.
 *
 * @param props - see {@link DatePickerProps}.
 */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  function DatePicker(
    {
      id,
      value,
      onChange,
      min,
      max,
      invalid = false,
      describedBy,
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <input
        {...rest}
        ref={ref}
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className={cn(inputVariants({ invalid }), className)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
    );
  },
);
