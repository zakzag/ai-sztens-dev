import type { SpinnerProps } from './spinner.interface.js';
import { SPINNER_DEFAULT_LABEL } from './spinner.const.js';
import { spinnerVariants } from './spinner.variants.js';
import { cn } from '../../lib/cn.js';

/**
 * Indeterminate loading indicator.
 *
 * Wrapper carries `role="status"` so a screen reader announces the label as a
 * live region; the visual ring is `aria-hidden` because it conveys nothing on
 * its own.
 *
 * @param props - see {@link SpinnerProps}.
 */
export function Spinner({
  size,
  label = SPINNER_DEFAULT_LABEL,
  className,
}: SpinnerProps) {
  return (
    <span
      role="status"
      className={cn('inline-flex items-center gap-2', className)}
    >
      <span aria-hidden="true" className={spinnerVariants({ size })} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
