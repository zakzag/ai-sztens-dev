/**
 * Dedicated status change of one customer (AIS-21).
 *
 * A route of its own (`PATCH /api/admin/customers/:id/status`) and not a field of
 * the general `PATCH`: the server also writes `statusChangedAt` and records the
 * change as its own audit operation, so a generic field edit must not be able to
 * carry it (`customers.interface.ts` of `@callback/api-client` says the same on
 * the service method).
 *
 * The invalidation covers the whole `customers` prefix: the status is a list
 * column and a detail header value at the same time, and the detail's
 * `overview` pairs carry `statusChangedAt`.
 */

import type { Customer, UpdateCustomerStatusInput } from '@callback/shared';
import { useApiMutation } from '../api/use-api-mutation.js';
import { customersService } from '../../services/api-client.js';
import { CUSTOMERS_QUERY_KEYS } from './customers.const.js';
import type { UseUpdateCustomerStatusResult } from './customers.interface.js';

/**
 * Changes the status of one customer and refreshes every `customers` query.
 *
 * @param id - the customer's uuid.
 * @returns the submit function, its pending flag and the mapped failure.
 */
export function useUpdateCustomerStatusMutation(
  id: string,
): UseUpdateCustomerStatusResult {
  const mutation = useApiMutation<Customer, UpdateCustomerStatusInput>({
    mutationFn: (input: UpdateCustomerStatusInput) =>
      customersService.updateStatus(id, input),
    mutationKey: ['customers', 'update-status'],
    invalidateKeys: [CUSTOMERS_QUERY_KEYS.all],
  });

  return {
    updateCustomerStatus: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
  };
}
