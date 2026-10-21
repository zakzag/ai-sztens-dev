import type { TableRowProps } from './table.interface.js';
import { cn } from '../../lib/cn.js';

/**
 * Table row. Hover is a secondary affordance only — it is never the sole
 * indicator of state.
 *
 * @param props - see {@link TableRowProps}.
 */
export function TableRow({ className, children, ...rest }: TableRowProps) {
  return (
    <tr {...rest} className={cn('transition-shadow duration-fast hover:bg-surface-overlay', className)}>
      {children}
    </tr>
  );
}
