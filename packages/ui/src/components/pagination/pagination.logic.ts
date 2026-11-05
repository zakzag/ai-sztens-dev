/**
 * Pure rules of {@link Pagination}.
 *
 * No React and no I/O: the page window, the range label and the page-size
 * clamping are verified with plain values (`pagination.logic.test.ts`), including
 * the degenerate cases (`totalPages = 0`, `total = 0`, a page beyond the last).
 */

import {
  PAGINATION_DEFAULT_MAX_BUTTONS,
  PAGINATION_RANGE_DASH,
  PAGINATION_RANGE_SEPARATOR,
} from './pagination.const.js';
import type { PaginationMeta } from './pagination.interface.js';

/** The first page number, and the smallest value any of these rules returns. */
const FIRST_PAGE = 1;

/** `1`, the smallest meaningful page size. */
const MIN_LIMIT = 1;

/**
 * The page numbers the pager should show.
 *
 * - no pages (`totalPages = 0`) → an empty list, so the caller can omit the
 *   number buttons entirely instead of rendering `[0]`;
 * - everything fits → every page;
 * - otherwise a window of `maxButtons` pages that keeps the current page inside
 *   and never runs past the first or the last page.
 *
 * @param meta - the pager block of the response.
 * @param maxButtons - how many page buttons at most; defaults to
 *   {@link PAGINATION_DEFAULT_MAX_BUTTONS}.
 * @returns the page numbers in ascending order.
 */
export function toVisiblePages(
  meta: PaginationMeta,
  maxButtons: number = PAGINATION_DEFAULT_MAX_BUTTONS,
): readonly number[] {
  const totalPages = Math.max(0, Math.trunc(meta.totalPages));

  if (totalPages === 0) {
    return [];
  }

  const windowSize = Math.max(1, Math.trunc(maxButtons));

  if (totalPages <= windowSize) {
    return Array.from({ length: totalPages }, (_, index) => index + FIRST_PAGE);
  }

  const current = Math.min(
    Math.max(FIRST_PAGE, Math.trunc(meta.page)),
    totalPages,
  );
  const half = Math.floor(windowSize / 2);
  const lastStart = totalPages - windowSize + 1;
  const start = Math.min(Math.max(FIRST_PAGE, current - half), lastStart);

  return Array.from(
    { length: windowSize },
    (_, index) => start + index,
  );
}

/**
 * The “which rows am I looking at” label, e.g. `1–20 / 137`.
 *
 * @param meta - the pager block of the response.
 * @returns the range label; `0 / 0` for an empty result set, because “1–0 / 0”
 *   would be a lie about a page that holds nothing.
 */
export function toRangeLabel(meta: PaginationMeta): string {
  const total = Math.max(0, Math.trunc(meta.total));

  if (total === 0) {
    return `0${PAGINATION_RANGE_SEPARATOR}0`;
  }

  const limit = Math.max(MIN_LIMIT, Math.trunc(meta.limit));
  const page = Math.max(FIRST_PAGE, Math.trunc(meta.page));
  const first = Math.min((page - FIRST_PAGE) * limit + FIRST_PAGE, total);
  const last = Math.min(page * limit, total);

  return `${first}${PAGINATION_RANGE_DASH}${last}${PAGINATION_RANGE_SEPARATOR}${total}`;
}

/**
 * Fits an arbitrary page size onto the options the select can show.
 *
 * A `<select>` whose `value` is not one of its `<option>` values renders blank —
 * that is the defect this prevents. An unknown size (a deep link with `?limit=30`,
 * a server default that changed) falls back to the **nearest** option rather than
 * to the first one, so the selector shows something close to what was requested.
 *
 * @param limit - the page size the response was produced with.
 * @param options - the selectable page sizes.
 * @returns one of `options`, or `limit` itself when there are no options.
 */
export function clampLimit(
  limit: number,
  options: readonly number[],
): number {
  if (options.length === 0 || options.includes(limit)) {
    return limit;
  }

  return options.reduce((closest, option) =>
    Math.abs(option - limit) < Math.abs(closest - limit) ? option : closest,
  );
}
