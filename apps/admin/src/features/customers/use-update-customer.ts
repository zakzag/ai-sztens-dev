/**
 * Field update of one customer (AIS-21).
 *
 * An **adapter**, not an implementation: the state wiring (pending flag, failure
 * projection, invalidation-after-success) lives in the generic
 * [`features/api`](../api) hooks, so this file keeps only what is specific to the
 * resource — the service call, the bound id and the query-key prefix.
 *
 * Three decisions worth keeping:
 *
 * - the id is **bound here** rather than sent in the body: `updateCustomerSchema`
 *   is `.strict()` and must never carry an address of its own;
 * - the invalidation asks for the whole `customers` prefix, because a field edit
 *   changes the list row as well as the detail (`hasMissingData` is derived), and
 *   a hand-patched cache would disagree with the server on the next request;
 * - there is **no** `meta.successMessage` on purpose: the form's notify port owns
 *   the success copy (`New-Admin-Page.md` step 15 / AIS-136), so a page never sets
 *   one on its writes.
 */

import type { Customer, UpdateCustomerInput } from '@callback/shared';
import { useApiMutation } from '../api/use-api-mutation.js';
import { customersService } from '../../services/api-client.js';
import { CUSTOMERS_QUERY_KEYS } from './customers.const.js';
import type { UseUpdateCustomerResult } from './customers.interface.js';

/**
 * Patches one customer and refreshes every `customers` query.
 *
 * @param id - the customer's uuid, i.e. the `:id` segment of the route.
 * @returns the submit function, its pending flag and the mapped failure.
 */
export function useUpdateCustomerMutation(
  id: string,
): UseUpdateCustomerResult {
  const mutation = useApiMutation<Customer, UpdateCustomerInput>({
    mutationFn: (input: UpdateCustomerInput) =>
      customersService.update(id, input),
    mutationKey: ['customers', 'update'],
    invalidateKeys: [CUSTOMERS_QUERY_KEYS.all],
  });

  return {
    updateCustomer: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
  };
}
