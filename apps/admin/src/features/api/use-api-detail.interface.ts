/**
 * Types of {@link useApiDetail} (AIS-114).
 *
 * A detail read has no pager, so the result is the payload itself — `null` until
 * a response arrives. That `null` is deliberate: “not loaded yet” and “loaded and
 * absent” are different states, and the second one is a `404` (an `ApiError`),
 * never a `null` payload.
 */

import type { QueryKey } from '@tanstack/react-query';
import type { ApiErrorView, ApiQueryFn } from './api-hooks.interface.js';

/** Inputs of {@link useApiDetail}. */
export interface UseApiDetailOptions<TData> {
  /** Cache key of the query, built in the use case's `*.const.ts`. */
  readonly queryKey: QueryKey;
  /** The service call; receives the abort signal from TanStack Query. */
  readonly queryFn: ApiQueryFn<TData>;
  /** `false` skips the request entirely (e.g. no identifier yet). */
  readonly enabled?: boolean;
}

/** Result of {@link useApiDetail}. */
export interface UseApiDetailResult<TData> extends ApiErrorView {
  /** The resource, or `null` until a response arrives. */
  readonly data: TData | null;
  /** `true` until the first response (or failure) arrives. */
  readonly isLoading: boolean;
  /** `true` while any request is in flight, including a manual refetch. */
  readonly isFetching: boolean;
  /** Manual retry for the error state. */
  readonly refetch: () => void;
}
