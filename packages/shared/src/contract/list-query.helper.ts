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
 * Builds the URL parameters of a list query.
 *
 * A field that is still at its default is **left out**, so `?page=1` and
 * `?sort=createdAt` never appear in the URL — the link stays readable and the
 * back button behaves the way the user expects. A field whose value is
 * `undefined` is left out for the same reason.
 *
 * @param query - the list query.
 * @param defaults - the values that count as "unchanged".
 * @returns the URL parameters.
 */
export function toListQueryParams(
  query: ListQuery & { readonly sort?: string },
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

  return params;
}
