import type { BadgeProps } from './badge.interface.js';
import { badgeVariants } from './badge.variants.js';
import { cn } from '../../lib/cn.js';

/**
 * Compact status/category label.
 *
 * @param props - see {@link BadgeProps}.
 */
export function Badge({ variant, className, children, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}
