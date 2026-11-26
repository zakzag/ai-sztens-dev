import type { TableProps } from './table.interface.js';
import { cn } from '../../lib/cn.js';
import { SHEEN_GLASS_CLASS } from '../../theme/theme.const.js';

/**
 * Raised table surface. Scrolls horizontally instead of overflowing narrow
 * viewports, so a wide data set never breaks the page layout.
 *
 * Like the card, the shell carries the gloss-only glass utility rather than
 * `surface-glass`: the specular gradient without a filter per row.
 *
 * @param props - see {@link TableProps}.
 */
export function Table({ className, children, ...rest }: TableProps) {
  return (
    <div
      className={`overflow-x-auto rounded-card border border-hairline border-border-hairline bg-surface-raised shadow-neu-raised ${SHEEN_GLASS_CLASS}`}
    >
      <table
        {...rest}
        className={cn('w-full border-collapse text-left text-sm', className)}
      >
        {children}
      </table>
    </div>
  );
}
