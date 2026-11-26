/**
 * TanStack Query hook of one customer's detail payload (AIS-20).
 *
 * An **adapter**, not an implementation: the state wiring lives in the generic
 * [`features/api`](../api) hooks, and this file keeps only what is specific to
 * the resource — the service call and the query key. Everything the page needs
 * (`data`, `isLoading`, `isFetching`, `error`, `errorMessage`, `errorSurface`,
 * `refetch`) therefore comes from one place, and a second page cannot invent a
 * fourth error vocabulary.
 *
 * The key is `CUSTOMERS_QUERY_KEYS.detail(id)` from the shared factory
 * (`createEntityQueryKeys('customers')`), so it starts with the `all` prefix and
 * a write that invalidates `CUSTOMERS_QUERY_KEYS.all` refreshes this read too.
 * The detail response is **never** derived from the list cache: the detail
 * carries `tags`, `contacts` and `customerUsers`, the list rows do not.
 */

import type { CustomerDetail } from '@callback/shared';
import { useApiDetail } from '../api/use-api-detail.js';
import type { UseApiDetailResult } from '../api/use-api-detail.interface.js';
import { customersService } from '../../services/api-client.js';
import { CUSTOMERS_QUERY_KEYS } from './customers.const.js';

/**
 * Reads one customer by id.
 *
 * A missing id disables the query instead of issuing a request for an empty
 * path segment: that request would answer `404` and the page would show the
 * "this customer does not exist" copy for a URL that named no customer at all.
 * `useApiDetail` reports `isLoading: false` for a disabled query, so the page
 * does not stay on the skeleton either.
 *
 * @param id - the `:id` segment of the URL, or `undefined` while it is absent.
 * @returns the detail payload (or `null` until the first response), the flags
 *   of the four UI states and `refetch`.
 */
export function useCustomerDetail(
  id: string | undefined,
): UseApiDetailResult<CustomerDetail> {
  const hasId = id !== undefined && id.length > 0;

  return useApiDetail<CustomerDetail>({
    queryKey: CUSTOMERS_QUERY_KEYS.detail(id ?? ''),
    queryFn: () => customersService.findById(id ?? ''),
    enabled: hasId,
  });
}
