/**
 * TanStack Query hook of the `customers` list (AIS-19).
 *
 * An **adapter**, not an implementation: the state wiring lives in the generic
 * [`features/api`](../api) hooks, and this file keeps only what is specific to
 * the resource — the service call, the query key and the stable empty list.
 *
 * Server state stays in the query cache and is never copied into a store. The
 * params are both the request and part of the key, so a page, sort or filter
 * change produces a new cache entry instead of refetching under the old one.
 */

import type { Customer, CustomerListQuery } from '@callback/shared';
import { useApiList } from '../api/use-api-list.js';
import { customersService } from '../../services/api-client.js';
import { CUSTOMERS_QUERY_KEYS, EMPTY_CUSTOMER_LIST } from './customers.const.js';
import type { CustomersListResult } from './customers.interface.js';

/**
 * Reads one page of customers.
 *
 * @param params - the validated list query, normally the URL params from
 *   `useListParams`; it is part of the query key, so a page change refetches.
 * @returns the rows, the envelope `meta` and the explicit `isLoading` /
 *   `isFetching` / error fields, so the page can render all four states without
 *   knowing anything about query objects.
 */
export function useCustomersList(
  params: CustomerListQuery,
): CustomersListResult {
  const { data: customers, ...listState } = useApiList<readonly Customer[]>({
    queryKey: CUSTOMERS_QUERY_KEYS.list(params),
    queryFn: () => customersService.list(params),
    emptyData: EMPTY_CUSTOMER_LIST,
  });

  return { customers, ...listState };
}
