import type { AlertProps } from './alert.interface.js';
import { alertVariants } from './alert.variants.js';
import { cn } from '../../lib/cn.js';

/**
 * Inline message block. `danger` is announced as `alert`, the other severities
 * as `status`, so screen readers pick the right politeness.
 *
 * @param props - see {@link AlertProps}.
 */
export function Alert({ variant, title, className, children, ...rest }: AlertProps) {
  return (
    <div
      {...rest}
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1' : undefined}>{children}</div> : null}
    </div>
  );
}
