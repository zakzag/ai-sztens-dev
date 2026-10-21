import type { TableSectionProps } from './table.interface.js';
import { cn } from '../../lib/cn.js';

/**
 * Table header section.
 *
 * @param props - see {@link TableSectionProps}.
 */
export function TableHead({ className, children, ...rest }: TableSectionProps) {
  return (
    <thead {...rest} className={cn('border-b border-hairline bg-surface-sunken', className)}>
      {children}
    </thead>
  );
}
