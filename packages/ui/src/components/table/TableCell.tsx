import type { TableCellProps } from './table.interface.js';
import { cn } from '../../lib/cn.js';

/**
 * Body cell.
 *
 * @param props - see {@link TableCellProps}.
 */
export function TableCell({ className, children, ...rest }: TableCellProps) {
  return (
    <td
      {...rest}
      className={cn('px-4 py-3 align-top text-text-secondary', className)}
    >
      {children}
    </td>
  );
}
