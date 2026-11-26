import { forwardRef } from 'react';
import { inputVariants } from '../input/input.variants.js';
import { cn } from '../../lib/cn.js';
import {
  SELECT_ARROW_PADDING,
  SELECT_PLACEHOLDER_VALUE,
} from './select.const.js';
import type { SelectProps } from './select.interface.js';

/**
 * Native `<select>` in the shared sunken control recipe.
 *
 * A native element on purpose: it brings the platform dropdown, keyboard
 * behaviour, form serialisation and screen-reader support for free, and it
 * remains registerable by react-hook-form. The ref is forwarded so a form can
 * focus the first invalid field.
 *
 * @param props - see {@link SelectProps}.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      id,
      options,
      placeholder,
      invalid = false,
      describedBy,
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <select
        {...rest}
        ref={ref}
        id={id}
        className={cn(
          inputVariants({ invalid }),
          SELECT_ARROW_PADDING,
          className,
        )}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      >
        {placeholder ? (
          <option value={SELECT_PLACEHOLDER_VALUE} disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    );
  },
);
