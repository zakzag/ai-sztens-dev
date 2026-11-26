/**
 * The generic paginated list read (AIS-114).
 *
 * Every list page used to repeat the same four lines: call the service, fall
 * back to an empty array, map the error three ways, expose a `refetch`. This
 * hook is that repetition, extracted once — it holds **no** business logic:
 * filtering, sorting and field paths stay in the use case's `*.logic.ts`, and
 * the query key (which *does* depend on the params) is supplied by the caller.
 *
 * Server state stays in the query cache: `data`/`meta` are read from it, never
 * copied into a store.
 */

import { useQuery } from '@tanstack/react-query';
import type { ApiResult } from '@callback/shared';
import type {
  UseApiListOptions,
  UseApiListResult,
} from './use-api-list.interface.js';
import { toApiErrorView } from './api-hooks.logic.js';

/**
 * Reads one page of a list resource.
 *
 * @param options - query key, service call, empty fallback and `enabled` flag.
 * @returns the rows, `meta.pagination`, the four UI states and `refetch`.
 */
export function useApiList<TRows>(
  options: UseApiListOptions<TRows>,
): UseApiListResult<TRows> {
  const { queryKey, queryFn, emptyData, enabled = true } = options;

  const query = useQuery<ApiResult<TRows>>({ queryKey, queryFn, enabled });

  // `undefined` is “no response yet” (loading or failed); `null` would be a
  // value, and the empty fallback has to stay the caller's stable reference.
  const hasData = query.data !== undefined;

  return {
    data: hasData ? query.data.data : emptyData,
    meta: hasData ? query.data.meta : null,
    // `isLoading` (not `isPending`): a query that was never enabled is pending
    // forever, and reporting that as “loading” would leave a disabled page on a
    // spinner it can never leave.
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    ...toApiErrorView(query.error),
    refetch: () => {
      void query.refetch();
    },
  };
}
