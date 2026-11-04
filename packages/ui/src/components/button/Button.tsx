import { forwardRef } from 'react';
import type { ButtonProps } from './button.interface.js';
import { buttonVariants } from './button.variants.js';
import { cn } from '../../lib/cn.js';

/**
 * Pressable action control with the shared neomorphic recipes.
 *
 * The component forwards its ref to the native `<button>` (AIS-117): the
 * overlay primitives pass it to Radix's `asChild` slots, which merge refs, and
 * an un-ref-able child would break the trigger wiring.
 *
 * @param props - see {@link ButtonProps}; `variant`/`size` select the recipe.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant,
      size,
      isLoading = false,
      type = 'button',
      className,
      disabled,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? isLoading}
        aria-busy={isLoading || undefined}
      >
        {isLoading ? (
          <span
            aria-hidden="true"
            className="size-3 rounded-full border border-current border-t-transparent animate-spin"
          />
        ) : null}
        {children}
      </button>
    );
  },
);
