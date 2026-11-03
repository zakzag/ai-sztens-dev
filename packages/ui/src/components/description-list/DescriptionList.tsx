import type { DescriptionListProps } from './description-list.interface.js';
import {
  DESCRIPTION_LIST_EMPTY_MESSAGE,
  DESCRIPTION_LIST_LOADING_ROWS,
} from './description-list.const.js';
import { Skeleton } from '../skeleton/Skeleton.js';
import { cn } from '../../lib/cn.js';

/**
 * Label/value pairs rendered as a real `<dl>`.
 *
 * The three states are explicit and mutually exclusive:
 * - `isLoading` → skeleton rows, and **no** `dd` at all (a placeholder must not
 *   be mistaken for data by a screen reader or by a query in a test);
 * - empty → the caller's `empty` slot, or a neutral one-liner;
 * - success → one `<dt>`/`<dd>` pair per item.
 *
 * Each pair sits in a `<div>`, which HTML allows inside `<dl>` since HTML 5.2
 * and is what makes the two-column grid possible without breaking semantics.
 *
 * @param props - see {@link DescriptionListProps}.
 */
export function DescriptionList({
  items,
  isLoading = false,
  empty,
  columns = 1,
  className,
}: DescriptionListProps) {
  if (isLoading) {
    return (
      <Skeleton
        shape="line"
        lines={DESCRIPTION_LIST_LOADING_ROWS}
        className={className}
      />
    );
  }

  if (items.length === 0) {
    return (
      <>
        {empty ?? (
          <p className="text-sm text-text-muted">
            {DESCRIPTION_LIST_EMPTY_MESSAGE}
          </p>
        )}
      </>
    );
  }

  return (
    <dl
      className={cn(
        'grid gap-3',
        columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1">
          <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {item.label}
          </dt>
          <dd className="text-sm text-text-secondary">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
