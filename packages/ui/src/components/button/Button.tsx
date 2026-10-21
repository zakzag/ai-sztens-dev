import type { ButtonProps } from './button.interface.js';
import { buttonVariants } from './button.variants.js';
import { cn } from '../../lib/cn.js';

/**
 * Pressable action control with the shared neomorphic recipes.
 *
 * @param props - see {@link ButtonProps}; `variant`/`size` select the recipe.
 */
export function Button({
  variant,
  size,
  isLoading = false,
  type = 'button',
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
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
}
