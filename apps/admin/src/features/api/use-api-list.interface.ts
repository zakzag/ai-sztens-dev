/**
 * Types of {@link useApiList} (AIS-114).
 *
 * A list read differs from a detail read in exactly one way: its response is an
 * `ApiResult`, so the pager block travels with the rows. That is why the result
 * is generic over the **rows** and exposes `meta` separately instead of wrapping
 * the whole envelope into `data`.
 */

import type { QueryKey } from '@tanstack/react-query';
import type { ApiResult } from '@callback/shared';
import type {
  ApiErrorView,
  ApiQueryFn,
  PaginatedMeta,
} from './api-hooks.interface.js';

/** Inputs of {@link useApiList}. */
export interface UseApiListOptions<TRows> {
  /**
   * Cache key of the query, built in the use case's `*.const.ts`.
   *
   * Passed in instead of computed here: the key has to reflect the list params,
   * and only the use case knows what those mean.
   */
  readonly queryKey: QueryKey;
  /** The service call; receives the abort signal from TanStack Query. */
  readonly queryFn: ApiQueryFn<ApiResult<TRows>>;
  /**
   * Rows returned while there is no data yet (loading, failure).
   *
   * Must be a **stable** reference (a frozen constant), otherwise the table sees
   * a new array identity on every render and memoisation is defeated.
   */
  readonly emptyData: TRows;
  /** `false` skips the request entirely; defaults to `true`. */
  readonly enabled?: boolean;
}

/** Result of {@link useApiList}: rows + pager + the four UI states. */
export interface UseApiListResult<TRows> extends ApiErrorView {
  /** The rows of the current page; `emptyData` until a response arrives. */
  readonly data: TRows;
  /** `meta.pagination` (plus `requestId`/`timestamp`), or `null` while loading. */
  readonly meta: PaginatedMeta<TRows> | null;
  /** `true` until the first response (or failure) arrives. */
  readonly isLoading: boolean;
  /** `true` while any request is in flight, including a manual refetch. */
  readonly isFetching: boolean;
  /** Manual retry for the error state. */
  readonly refetch: () => void;
}
