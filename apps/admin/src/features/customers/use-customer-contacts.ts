/**
 * Contact writes of one customer (AIS-179).
 *
 * Three **adapters**, not implementations: the pending flag, the failure
 * projection and the invalidation-after-success all live in the generic
 * [`features/api`](../api) hooks, so this file keeps only what is specific to the
 * resource — the service call, the bound ids and the query-key prefix.
 *
 * Decisions worth keeping:
 *
 * - the customer id is **bound here** and never sent in a body: the request
 *   schemas are `.strict()` and must not carry an address of their own;
 * - the invalidation asks for the whole `customers` prefix, because the tabs read
 *   the **detail** payload (`D-W3`): a contact change makes the detail stale, and
 *   the list row's `primaryContactName`/`lastActivityAt` with it;
 * - **no** `meta.successMessage` on the two form writes — the form's notify port
 *   owns that copy (`New-Admin-Page.md` step 15 / AIS-136). The archive carries
 *   one, because a `ConfirmDialog` has no notify port of its own.
 */

import type { Contact, CreateContactInput, UpdateContactInput } from '@callback/shared';
import { useApiMutation } from '../api/use-api-mutation.js';
import { customersService } from '../../services/api-client.js';
import {
  CUSTOMERS_CONTACT_REMOVE_SUCCESS_MESSAGE,
  CUSTOMERS_QUERY_KEYS,
} from './customers.const.js';
import type {
  UseCreateContactResult,
  UseRemoveContactResult,
  UseUpdateContactResult,
} from './customers.interface.js';

/**
 * Adds one contact to a customer.
 *
 * `roles` is the whole role set of the new contact and the server decides
 * `isActive`; the hook therefore forwards the payload untouched.
 *
 * @param customerId - the customer's uuid, i.e. the detail route's `:id`.
 * @returns the submit function, its pending flag and the mapped failure.
 */
export function useCreateContactMutation(
  customerId: string,
): UseCreateContactResult {
  const mutation = useApiMutation<Contact, CreateContactInput>({
    mutationFn: (input: CreateContactInput) =>
      customersService.createContact(customerId, input),
    mutationKey: ['customers', 'contact', 'create'],
    invalidateKeys: [CUSTOMERS_QUERY_KEYS.all],
  });

  return {
    createContact: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
  };
}

/**
 * Patches one contact of a customer.
 *
 * @param customerId - the customer's uuid.
 * @param contactId - the contact's uuid.
 * @returns the submit function, its pending flag and the mapped failure.
 */
export function useUpdateContactMutation(
  customerId: string,
  contactId: string,
): UseUpdateContactResult {
  const mutation = useApiMutation<Contact, UpdateContactInput>({
    mutationFn: (input: UpdateContactInput) =>
      customersService.updateContact(customerId, contactId, input),
    mutationKey: ['customers', 'contact', 'update'],
    invalidateKeys: [CUSTOMERS_QUERY_KEYS.all],
  });

  return {
    updateContact: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
  };
}

/**
 * Archives one contact — the soft delete that also frees the `primary` slot.
 *
 * @param customerId - the customer's uuid.
 * @param contactId - the contact's uuid.
 * @returns the trigger, its pending flag and the mapped failure.
 */
export function useRemoveContactMutation(
  customerId: string,
  contactId: string,
): UseRemoveContactResult {
  const mutation = useApiMutation<null, void>({
    mutationFn: () => customersService.removeContact(customerId, contactId),
    mutationKey: ['customers', 'contact', 'remove'],
    invalidateKeys: [CUSTOMERS_QUERY_KEYS.all],
    meta: { successMessage: CUSTOMERS_CONTACT_REMOVE_SUCCESS_MESSAGE },
  });

  return {
    removeContact: () => mutation.mutateAsync(),
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
  };
}
