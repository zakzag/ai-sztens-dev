import type { PaginationProps } from './pagination.interface.js';
import { PAGINATION_DEFAULT_ARIA_LABEL } from './pagination.const.js';
import { PaginationLimitSelector } from './PaginationLimitSelector.js';
import { PaginationPages } from './PaginationPages.js';
import { toRangeLabel, toVisiblePages } from './pagination.logic.js';
import { cn } from '../../lib/cn.js';

/** A pager always has at least one conceptual page, even for an empty result. */
const MIN_TOTAL_PAGES = 1;

/**
 * Pager of a server-paginated list.
 *
 * It renders `meta.pagination` and reports intent; it never stores the page. That
 * is deliberate: the page lives in the URL (`useListParams`), so a copy inside
 * the component would immediately disagree with a back/forward navigation.
 *
 * @param props - see {@link PaginationProps}.
 */
export function Pagination({
  meta,
  onPageChange,
  onLimitChange,
  limitOptions,
  ariaLabel = PAGINATION_DEFAULT_ARIA_LABEL,
  className,
}: PaginationProps) {
  const pages = toVisiblePages(meta);
  const totalPages = Math.max(MIN_TOTAL_PAGES, meta.totalPages);
  const selectableLimits = limitOptions ?? [];
  const canChangeLimit =
    onLimitChange !== undefined && selectableLimits.length > 0;

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        className,
      )}
    >
      <p className="text-sm text-text-secondary">{toRangeLabel(meta)}</p>
      <PaginationPages
        pages={pages}
        page={meta.page}
        isFirstPage={meta.page <= MIN_TOTAL_PAGES}
        isLastPage={meta.page >= totalPages}
        onPageChange={onPageChange}
      />
      {onLimitChange !== undefined && canChangeLimit ? (
        <PaginationLimitSelector
          limit={meta.limit}
          options={selectableLimits}
          onLimitChange={onLimitChange}
        />
      ) : null}
    </nav>
  );
}
