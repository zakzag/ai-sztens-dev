import type { PaginationPagesProps } from './pagination.interface.js';
import {
  PAGINATION_ACTIVE_CLASSES,
  PAGINATION_CONTROL_CLASSES,
  PAGINATION_NEXT_GLYPH,
  PAGINATION_NEXT_LABEL,
  PAGINATION_PREVIOUS_GLYPH,
  PAGINATION_PREVIOUS_LABEL,
} from './pagination.const.js';
import { cn } from '../../lib/cn.js';

/**
 * The number buttons plus the previous/next controls.
 *
 * Renders nothing when there are no pages: an empty result set has nothing to
 * navigate, and a row of permanently disabled buttons would suggest otherwise.
 *
 * The current page is marked with `aria-current="page"`; the arrows carry an
 * `aria-label` so their glyph is never the accessible name.
 *
 * @param props - see {@link PaginationPagesProps}.
 */
export function PaginationPages({
  pages,
  page,
  isFirstPage,
  isLastPage,
  onPageChange,
}: PaginationPagesProps) {
  if (pages.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap items-center gap-1">
      <li>
        <button
          type="button"
          aria-label={PAGINATION_PREVIOUS_LABEL}
          className={PAGINATION_CONTROL_CLASSES}
          disabled={isFirstPage}
          onClick={() => {
            onPageChange(page - 1);
          }}
        >
          <span aria-hidden="true">{PAGINATION_PREVIOUS_GLYPH}</span>
        </button>
      </li>
      {pages.map((pageNumber) => (
        <li key={pageNumber}>
          <button
            type="button"
            aria-current={pageNumber === page ? 'page' : undefined}
            className={cn(
              PAGINATION_CONTROL_CLASSES,
              pageNumber === page ? PAGINATION_ACTIVE_CLASSES : null,
            )}
            onClick={() => {
              onPageChange(pageNumber);
            }}
          >
            {pageNumber}
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          aria-label={PAGINATION_NEXT_LABEL}
          className={PAGINATION_CONTROL_CLASSES}
          disabled={isLastPage}
          onClick={() => {
            onPageChange(page + 1);
          }}
        >
          <span aria-hidden="true">{PAGINATION_NEXT_GLYPH}</span>
        </button>
      </li>
    </ul>
  );
}
