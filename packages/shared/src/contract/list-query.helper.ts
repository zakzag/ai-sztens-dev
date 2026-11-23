/**
 * Pure helpers of the list query (AIS-106).
 *
 * Two jobs, both on the **client** side:
 *
 * - {@link mergeListQuery} adds a resource's own filters to the flat list
 *   query without letting them overwrite the paging fields.
 * - {@link toListQueryParams} turns the query into URL parameters, leaving out
 *   everything that is still at its default — so the URL only carries what the
 *   user actually changed.
 *
 * No I/O, no clock, no framework: the same functions run in a component, in a
 * test and on the server.
 */

import type { PaginationMeta } from './envelope.interface.js';
import {
  LIST_QUERY_DEFAULT_LIMIT,
  LIST_QUERY_MAX_SEARCH_LENGTH,
  type ListQuery,
} from './list-query.schema.js';

/**
 * The defaults a list query is compared against.
 *
 * The URL builder needs to know what "unchanged" means, and that depends on
 * the resource's default sort — which is why the sort default is a parameter
 * and not a constant.
 */
export interface ListQueryDefaults {
  /** The default page size. */
  readonly limit: number;

  /** The default sort direction. */
  readonly order: string;

  /** The default sort column, when the resource has one. */
  readonly sort?: string;
}

/**
 * The paging fields, written first and in a fixed order.
 *
 * A `Set` and not an array: the membership test runs once per query key, and the
 * order of the paging block is guaranteed by the explicit `if` blocks below, not
 * by this collection.
 */
const PAGING_KEYS: ReadonlySet<string> = new Set([
  'page',
  'limit',
  'order',
  'q',
  'sort',
]);

/** The defaults of the base list query. */
export const LIST_QUERY_DEFAULTS: ListQueryDefaults = {
  limit: LIST_QUERY_DEFAULT_LIMIT,
  order: 'desc',
};

/**
 * Merges a resource's own filters into the flat list query.
 *
 * The flat fields (`page`, `limit`, `order`, `q`, `sort`) always win: a
 * resource filter can never move the user to another page or change the page
 * size by accident.
 *
 * @param query - the flat list query.
 * @param filters - the resource-specific filters.
 * @returns the query with the filters merged in.
 */
export function mergeListQuery<TFilters extends Record<string, unknown>>(
  query: ListQuery & { readonly sort?: string },
  filters: TFilters,
): ListQuery & { readonly sort?: string } & TFilters {
  return {
    ...filters,
    page: query.page,
    limit: query.limit,
    order: query.order,
    ...(query.q === undefined ? {} : { q: query.q }),
    ...(query.sort === undefined ? {} : { sort: query.sort }),
  };
}

/**
 * Builds `meta.pagination` of a paginated list response.
 *
 * The arithmetic lives here, in a pure function, because **both** sides need
 * it: the server puts it into the envelope, and the client's pager recomputes
 * the same numbers when it renders. Duplicating the `ceil` in two places would
 * eventually disagree at the boundaries.
 *
 * `totalPages` is `0` when nothing matches (`total === 0`) and `page` is echoed
 * back as requested — a page past the end is not an error, it is an empty slice
 * of a real result set, and rewriting it to the last page would move the user
 * without them asking.
 *
 * @param query - the query that was served (`page` and `limit` are what matter).
 * @param total - number of matching rows, across **all** pages.
 * @returns the `meta.pagination` block.
 */
export function toPaginationMeta(
  query: Pick<ListQuery, 'page' | 'limit'>,
  total: number,
): PaginationMeta {
  return {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: total <= 0 ? 0 : Math.ceil(total / query.limit),
  };
}

/**
 * Builds the URL parameters of a list query.
 *
 * A field that is still at its default is **left out**, so `?page=1` and
 * `?sort=createdAt` never appear in the URL — the link stays readable and the
 * back button behaves the way the user expects. A field whose value is
 * `undefined` is left out for the same reason.
 *
 * The five paging fields are written first, in a fixed order; **every other key**
 * of the query is treated as a resource filter and appended after them (the
 * `customers` list has `type`, `status`, `source` and `responsibleOperatorId`).
 * Without that pass-through a filter would be silently dropped on its way to the
 * server — a lie the client could not see.
 *
 * The type parameter is what keeps every caller's own query type assignable: a
 * resource filter cannot be described by an index signature without forcing an
 * `interface`-shaped query to add one, so the extra keys are accepted through the
 * caller's type and narrowed at runtime.
 *
 * @param query - the list query, optionally carrying resource-specific filters.
 * @param defaults - the values that count as "unchanged".
 * @returns the URL parameters.
 */
export function toListQueryParams<
  TQuery extends ListQuery & { readonly sort?: string },
>(
  query: TQuery,
  defaults: ListQueryDefaults = LIST_QUERY_DEFAULTS,
): URLSearchParams {
  const params = new URLSearchParams();

  if (query.page > 1) {
    params.set('page', String(query.page));
  }

  if (query.limit !== defaults.limit) {
    params.set('limit', String(query.limit));
  }

  if (query.order !== defaults.order) {
    params.set('order', query.order);
  }

  if (
    query.q !== undefined &&
    query.q.length > 0 &&
    query.q.length <= LIST_QUERY_MAX_SEARCH_LENGTH
  ) {
    params.set('q', query.q);
  }

  if (query.sort !== undefined && query.sort !== defaults.sort) {
    params.set('sort', query.sort);
  }

  appendExtraFilters(params, query);

  return params;
}

/**
 * Appends the resource-specific filters of a query.
 *
 * Skips the paging fields (already written) and the three "no filter" values
 * (absent, `null`, empty string). Numbers and booleans are stringified, because
 * `URLSearchParams` only stores text.
 *
 * `query` is typed `object` on purpose: the caller's own query type is a generic
 * type parameter (see {@link toListQueryParams}), and requiring an index
 * signature here would reject it. Each value is narrowed by
 * {@link isFilterValue} before it is written.
 *
 * @param params - the parameter bag to extend.
 * @param query - the list query, possibly carrying extra filters.
 */
function appendExtraFilters(params: URLSearchParams, query: object): void {
  for (const [key, value] of Object.entries(query)) {
    if (PAGING_KEYS.has(key) || !isFilterValue(value)) {
      continue;
    }

    params.set(key, String(value));
  }
}

/**
 * @param value - one entry of a query object.
 * @returns `true` for a value the URL should carry: a non-empty string, a number
 *   or a boolean.
 */
function isFilterValue(value: unknown): value is string | number | boolean {
  if (typeof value === 'string') {
    return value.length > 0;
  }

  return typeof value === 'number' || typeof value === 'boolean';
}
