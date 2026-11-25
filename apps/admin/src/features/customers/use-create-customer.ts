/**
 * Creation of one customer (AIS-182).
 *
 * An **adapter**, like every other write of this feature: the state wiring
 * (pending flag, failure projection, invalidation-after-success) lives in the
 * generic [`features/api`](../api) hooks, so this file keeps only what is
 * specific to the resource — the service call, the mutation key and the query-key
 * prefix.
 *
 * Three decisions worth keeping:
 *
 * - the **whole draft** travels, not a patch: `createCustomerSchema` accepts
 *   absent optional fields and defaults `registeredAddressCountry` /
 *   `status` server-side, so the caller never has to pre-fill them;
 * - the invalidation asks for the whole `customers` prefix, because a new row
 *   changes the list page, its `meta.pagination.total` and the empty state;
 * - the hook **does not navigate**. A `features` hook must not know the router
 *   (`react.coding-standards.md` §2), so the wizard's review step performs the
 *   jump to `/customers/:id?tab=contacts` after the write resolves (`D-W6`).
 * - there is **no** `meta.successMessage`: the review step's notify port owns
 *   the success copy (`New-Admin-Page.md` step 15 / AIS-136).
 */

import type { CreateCustomerInput, Customer } from '@callback/shared';
import { useApiMutation } from '../api/use-api-mutation.js';
import { customersService } from '../../services/api-client.js';
import { CUSTOMERS_QUERY_KEYS } from './customers.const.js';
import type { UseCreateCustomerResult } from './customers.interface.js';

/**
 * Creates one customer from the wizard's draft.
 *
 * @returns the submit function, its pending flag and the mapped failure.
 */
export function useCreateCustomerMutation(): UseCreateCustomerResult {
  const mutation = useApiMutation<Customer, CreateCustomerInput>({
    mutationFn: (input: CreateCustomerInput) => customersService.create(input),
    mutationKey: ['customers', 'create'],
    invalidateKeys: [CUSTOMERS_QUERY_KEYS.all],
  });

  return {
    createCustomer: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
  };
}
