/**
 * Pure rules of {@link DataTable}.
 *
 * The sort *interaction* is a value transformation, not a side effect: the table
 * reports what the user asked for and never re-orders the rows it was given
 * (decision D2). Both branches — a new column and a direction toggle on the
 * current one — are covered by `data-table.logic.test.ts`.
 */

import { DATA_TABLE_FIRST_SORT_ORDER } from './data-table.const.js';
import type { DataTableSort } from './data-table.interface.js';

/** The `aria-sort` value of a header cell. */
export type DataTableAriaSort = 'ascending' | 'descending' | 'none';

/**
 * @param columnId - the column whose header is being rendered.
 * @param sort - the current sort of the list.
 * @returns `ascending`/`descending` for the sorted column, `none` otherwise.
 */
export function toAriaSort(
  columnId: string,
  sort: DataTableSort | null,
): DataTableAriaSort {
  if (sort === null || sort.columnId !== columnId) {
    return 'none';
  }

  return sort.order === 'asc' ? 'ascending' : 'descending';
}

/**
 * What a header click should request.
 *
 * Clicking the already-sorted column flips the direction (the familiar toggle);
 * clicking another column starts with `asc`, because carrying the previous
 * direction over would silently re-order the new column descending.
 *
 * @param columnId - the clicked column.
 * @param sort - the current sort of the list.
 * @returns the sort to report to the caller.
 */
export function toNextSort(
  columnId: string,
  sort: DataTableSort | null,
): DataTableSort {
  if (sort !== null && sort.columnId === columnId) {
    return {
      columnId,
      order: sort.order === 'asc' ? 'desc' : 'asc',
    };
  }

  return { columnId, order: DATA_TABLE_FIRST_SORT_ORDER };
}
