/**
 * Archive (soft delete) write of one customer (AIS-19, reused by AIS-21).
 *
 * Lives in `features/` because both the list row menu (this ticket) and the
 * detail header (AIS-21) trigger it — two pages, one use case, one invalidation
 * rule. The mutation refreshes the whole `customers` prefix instead of patching
 * the cached page: an archived row changes `total`, so a hand-patched list
 * would disagree with the server on the very next page request.
 */

import { useApiMutation } from '../api/use-api-mutation.js';
import { customersService } from '../../services/api-client.js';
import {
  CUSTOMERS_ARCHIVE_SUCCESS_MESSAGE,
  CUSTOMERS_QUERY_KEYS,
} from './customers.const.js';
import type { UseArchiveCustomerResult } from './customers.interface.js';

/**
 * @returns the archive trigger, its pending flag and the mapped failure.
 */
export function useArchiveCustomerMutation(): UseArchiveCustomerResult {
  const mutation = useApiMutation<null, string>({
    mutationFn: (id: string) => customersService.remove(id),
    invalidateKeys: [CUSTOMERS_QUERY_KEYS.all],
    meta: { successMessage: CUSTOMERS_ARCHIVE_SUCCESS_MESSAGE },
  });

  return {
    archiveCustomer: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
  };
}
