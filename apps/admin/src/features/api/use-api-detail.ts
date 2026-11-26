/**
 * The generic single-resource read (AIS-114).
 *
 * The counterpart of {@link useApiList} for a resource addressed by one key: no
 * pager, so the payload is returned as-is and `null` means “no response yet”.
 * A missing resource is not `null` — the transport turns a `404` into an
 * `ApiError`, which the shared classifier routes to the `page` tier.
 */

import { useQuery } from '@tanstack/react-query';
import type {
  UseApiDetailOptions,
  UseApiDetailResult,
} from './use-api-detail.interface.js';
import { toApiErrorView } from './api-hooks.logic.js';

/**
 * Reads one resource by key.
 *
 * @param options - query key, service call and `enabled` flag.
 * @returns the resource (or `null`), the four UI states and `refetch`.
 */
export function useApiDetail<TData>(
  options: UseApiDetailOptions<TData>,
): UseApiDetailResult<TData> {
  const { queryKey, queryFn, enabled = true } = options;

  const query = useQuery<TData>({ queryKey, queryFn, enabled });

  return {
    data: query.data === undefined ? null : query.data,
    // `isLoading` (not `isPending`): a disabled query is pending forever, so a
    // `isPending`-based flag would never settle for an `enabled: false` read.
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    ...toApiErrorView(query.error),
    refetch: () => {
      void query.refetch();
    },
  };
}
