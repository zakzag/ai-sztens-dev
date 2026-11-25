/**
 * Pure rules of the two login-user forms (AIS-179).
 *
 * The invite and the edit form share the name and the role; they differ in the
 * e-mail (an invitation carries it, an edit does not) and the status (only the
 * edit form may change it, and only between the operator-managed values).
 *
 * `CUSTOMER_USER_MANAGED_STATUS_VALUES` — not the full status enum — is what the
 * edit schema accepts: `invited` is a server-written state and the request schema
 * rejects it, so offering it would be a form that can only fail.
 */

import {
  CUSTOMER_USER_MANAGED_STATUS_VALUES,
  CUSTOMER_USER_NAME_MAX_LENGTH,
  CUSTOMER_USER_ROLE_VALUES,
  emailSchema,
  type InviteCustomerUserInput,
  type UpdateCustomerUserInput,
} from '@callback/shared';
import { z } from 'zod';
import type { CustomerUserViewModel } from '../../entities/customer/customer.interface.js';
import type {
  CustomerUserEditFormValues,
  CustomerUserInviteFormValues,
} from './customers.interface.js';

/** Body of the invite form: name, a globally unique e-mail and a role. */
export const customerUserInviteFormSchema = z.object({
  name: z.string().trim().min(1).max(CUSTOMER_USER_NAME_MAX_LENGTH),
  email: emailSchema,
  role: z.enum(CUSTOMER_USER_ROLE_VALUES),
});

/** Body of the edit form: name, role and one of the managed statuses. */
export const customerUserEditFormSchema = z.object({
  name: z.string().trim().min(1).max(CUSTOMER_USER_NAME_MAX_LENGTH),
  role: z.enum(CUSTOMER_USER_ROLE_VALUES),
  status: z.enum(CUSTOMER_USER_MANAGED_STATUS_VALUES),
});

/** The values an invitation starts from — the server's default role is `member`. */
export const EMPTY_USER_INVITE_FORM_VALUES: CustomerUserInviteFormValues =
  Object.freeze({
    name: '',
    email: '',
    role: 'member',
  });

/**
 * @param user - the row being edited, already mapped.
 * @returns the values the edit inputs are seeded with.
 */
export function toCustomerUserEditFormValues(
  user: CustomerUserViewModel,
): CustomerUserEditFormValues {
  return {
    name: user.name,
    role: user.role,
    // An `invited` row cannot be edited through this form (its revoke action is
    // the only write the API allows), but the fallback keeps the type total.
    status: user.status === 'invited' ? 'active' : user.status,
  };
}

/**
 * @param values - the validated invite values.
 * @returns the body of `POST /:id/customer-users`.
 */
export function toInviteCustomerUserInput(
  values: CustomerUserInviteFormValues,
): InviteCustomerUserInput {
  return {
    name: values.name.trim(),
    email: values.email,
    role: values.role,
  };
}

/**
 * @param values - the validated edit values.
 * @param updatedAt - the version the form was seeded from.
 * @returns the body of `PATCH /:id/customer-users/:customerUserId`.
 */
export function toUpdateCustomerUserInput(
  values: CustomerUserEditFormValues,
  updatedAt: string,
): UpdateCustomerUserInput {
  return {
    name: values.name.trim(),
    role: values.role,
    status: values.status,
    updatedAt,
  };
}
