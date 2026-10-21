import type { TableHeaderCellProps } from './table.interface.js';
import { cn } from '../../lib/cn.js';

/**
 * Column header cell.
 *
 * @param props - see {@link TableHeaderCellProps}.
 */
export function TableHeaderCell({ className, children, ...rest }: TableHeaderCellProps) {
  return (
    <th
      {...rest}
      scope={rest.scope ?? 'col'}
      className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted', className)}
    >
      {children}
    </th>
  );
}
