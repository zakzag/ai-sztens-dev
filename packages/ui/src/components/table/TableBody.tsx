import type { TableSectionProps } from './table.interface.js';
import { cn } from '../../lib/cn.js';

/**
 * Table body section.
 *
 * @param props - see {@link TableSectionProps}.
 */
export function TableBody({ className, children, ...rest }: TableSectionProps) {
  return (
    <tbody {...rest} className={cn('divide-y divide-border-hairline', className)}>
      {children}
    </tbody>
  );
}
