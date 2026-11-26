/**
 * Login-user writes of one customer (AIS-179).
 *
 * The counterpart of [`use-customer-contacts`](./use-customer-contacts.ts): three
 * adapters over `useApiMutation`, both ids bound, one invalidation rule.
 *
 * Two facts of the contract shape this file:
 *
 * - the **list** has no endpoint (`D-W3`): both tabs read `customerUsers` from the
 *   detail payload, so a write only has to invalidate the `customers` prefix;
 * - `status` accepts `active` / `inactive` only — `invited` is a server-written
 *   state, which is why the edit form's status options are derived from
 *   `CUSTOMER_USER_MANAGED_STATUS_VALUES` instead of the full status enum.
 */

import type {
  CustomerUser,
  InviteCustomerUserInput,
  UpdateCustomerUserInput,
} from '@callback/shared';
import { useApiMutation } from '../api/use-api-mutation.js';
import { customersService } from '../../services/api-client.js';
import {
  CUSTOMERS_QUERY_KEYS,
  CUSTOMERS_USER_REMOVE_SUCCESS_MESSAGE,
} from './customers.const.js';
import type {
  UseInviteCustomerUserResult,
  UseRemoveCustomerUserResult,
  UseUpdateCustomerUserResult,
} from './customers.interface.js';

/**
 * Invites one login user.
 *
 * No e-mail is sent by this API (that is AIS-73/74's job); the row starts in the
 * `invited` state, which is exactly what the revoke action later targets.
 *
 * @param customerId - the customer's uuid.
 * @returns the submit function, its pending flag and the mapped failure.
 */
export function useInviteCustomerUserMutation(
  customerId: string,
): UseInviteCustomerUserResult {
  const mutation = useApiMutation<CustomerUser, InviteCustomerUserInput>({
    mutationFn: (input: InviteCustomerUserInput) =>
      customersService.inviteCustomerUser(customerId, input),
    mutationKey: ['customers', 'customer-user', 'invite'],
    invalidateKeys: [CUSTOMERS_QUERY_KEYS.all],
  });

  return {
    inviteCustomerUser: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
  };
}

/**
 * Patches name, role and managed status of one login user.
 *
 * @param customerId - the customer's uuid.
 * @param customerUserId - the login user's uuid.
 * @returns the submit function, its pending flag and the mapped failure.
 */
export function useUpdateCustomerUserMutation(
  customerId: string,
  customerUserId: string,
): UseUpdateCustomerUserResult {
  const mutation = useApiMutation<CustomerUser, UpdateCustomerUserInput>({
    mutationFn: (input: UpdateCustomerUserInput) =>
      customersService.updateCustomerUser(customerId, customerUserId, input),
    mutationKey: ['customers', 'customer-user', 'update'],
    invalidateKeys: [CUSTOMERS_QUERY_KEYS.all],
  });

  return {
    updateCustomerUser: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
  };
}

/**
 * Revokes one **pending invitation**.
 *
 * The api-client documents `422 SEMANTIC_VALIDATION_FAILED` for a user that is no
 * longer `invited`, which is why the tab renders this action only on `invited`
 * rows (plan decision `D8`).
 *
 * @param customerId - the customer's uuid.
 * @param customerUserId - the login user's uuid.
 * @returns the trigger, its pending flag and the mapped failure.
 */
export function useRemoveCustomerUserMutation(
  customerId: string,
  customerUserId: string,
): UseRemoveCustomerUserResult {
  const mutation = useApiMutation<null, void>({
    mutationFn: () =>
      customersService.removeCustomerUser(customerId, customerUserId),
    mutationKey: ['customers', 'customer-user', 'remove'],
    invalidateKeys: [CUSTOMERS_QUERY_KEYS.all],
    meta: { successMessage: CUSTOMERS_USER_REMOVE_SUCCESS_MESSAGE },
  });

  return {
    removeCustomerUser: () => mutation.mutateAsync(),
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
  };
}
