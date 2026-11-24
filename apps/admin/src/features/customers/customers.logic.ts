/**
 * Pure rules of the `customers` list (AIS-19).
 *
 * Three jobs, all testable with values alone — no JSX, no hook, no I/O:
 *
 * 1. `isCustomerSortable` / `toCustomerSortField` — ask the **contract's**
 *    allow-list whether a column may be sorted, so the table can never offer a
 *    sort the API would answer with a `400`.
 * 2. `toTableSort` / `toSortParams` — the two directions between the URL query
 *    and the table's `DataTableSort`. The table reports intent, the URL owns the
 *    truth, and these two functions are the only translation points.
 * 3. `hasActiveFilters` — decides which empty-state copy applies ("no rows at
 *    all" vs "no rows for this filter").
 *
 * Deliberately absent: any `page` handling. `setParams` resets the page to `1`
 * whenever a field other than `page` changes (AIS-116 `D4`), so a sort patch
 * that also wrote `page` would state the same rule twice.
 */

import {
  CUSTOMER_DEFAULT_SORT,
  CUSTOMER_SORT_FIELDS,
  type CustomerListQuery,
  type CustomerSortField,
} from '@callback/shared';
import type { DataTableSort } from '@callback/ui';

/**
 * @param columnId - column id reported by the table.
 * @returns `true` when the contract accepts the column in `?sort=`.
 */
export function isCustomerSortable(
  columnId: string,
): columnId is CustomerSortField {
  return CUSTOMER_SORT_FIELDS.some((field) => field === columnId);
}

/**
 * Narrows a table column id onto the contract's sort allow-list.
 *
 * A non-sortable column never reaches this function (the table only offers
 * controls for `sortable` columns), but the fallback keeps the URL valid if it
 * ever did: an unknown `sort` is a `400` on the server.
 *
 * @param columnId - the column the user clicked.
 * @returns one of {@link CUSTOMER_SORT_FIELDS}.
 */
export function toCustomerSortField(columnId: string): CustomerSortField {
  return isCustomerSortable(columnId) ? columnId : CUSTOMER_DEFAULT_SORT;
}

/**
 * URL → table: what the header should mark as sorted.
 *
 * @param params - the parsed list query (the URL).
 * @returns the sort the table renders.
 */
export function toTableSort(params: CustomerListQuery): DataTableSort {
  return { columnId: params.sort, order: params.order };
}

/**
 * Table → URL: the query patch a sort request becomes.
 *
 * Returned as a patch, never as two writes, so the caller hands it to
 * `setParams`, which performs **one** URL write for `sort` + `order`.
 *
 * @param sort - the sort the table reported.
 * @returns the query fields to write.
 */
export function toSortParams(
  sort: DataTableSort,
): Pick<CustomerListQuery, 'sort' | 'order'> {
  return { sort: toCustomerSortField(sort.columnId), order: sort.order };
}

/**
 * Whether the current query narrows the list at all.
 *
 * Used to choose the empty-state copy: an empty result with no filter is a
 * genuinely empty database, while an empty result *with* a filter means the
 * filter is too narrow — two different next steps for the operator.
 *
 * @param params - the parsed list query.
 * @returns `true` when the free-text search or any of the three filters is set.
 */
export function hasActiveFilters(params: CustomerListQuery): boolean {
  const hasSearch = params.q !== undefined && params.q.length > 0;

  return (
    hasSearch ||
    params.type !== undefined ||
    params.status !== undefined ||
    params.source !== undefined
  );
}
