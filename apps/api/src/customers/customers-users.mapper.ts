/**
 * Pure mapping of the customer login users (AIS-178, slice e).
 *
 * Row → wire payload, invitation body → insert payload, patch body → column
 * subset, and row → the record the audit diff compares. No I/O, no Nest, no
 * Drizzle query building, so every branch (`null` vs. set, defaults, `Date` vs.
 * string) is trivial to unit test.
 *
 * {@link toCustomerUser} is also what the **detail** response uses (it moved here
 * from `customers.mapper.ts`), so the tab and the endpoints cannot disagree about
 * the shape of a login user.
 */

import type {
  CustomerUser,
  InviteCustomerUserInput,
  UpdateCustomerUserInput,
} from '@callback/shared';
import { toIsoString, toNullableIsoString } from '../common/date/iso-date.js';
import type { CustomerUserRow, NewCustomerUserRow } from '../db/schema.js';
import {
  CUSTOMER_USER_DEFAULT_ROLE,
  CUSTOMER_USER_INITIAL_STATUS,
} from './customers-users.const.js';
import type { CustomerUserPatch } from './customers-users.interface.js';

/**
 * Maps a login-user row to the wire payload.
 *
 * @param row - the row as read or as written.
 * @returns the `CustomerUser` payload with ISO 8601 timestamps.
 */
export function toCustomerUser(row: CustomerUserRow): CustomerUser {
  return {
    id: row.id,
    customerId: row.customerId,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    invitedByOperatorId: row.invitedByOperatorId,
    invitedAt: toNullableIsoString(row.invitedAt),
    acceptedAt: toNullableIsoString(row.acceptedAt),
    lastLoginAt: toNullableIsoString(row.lastLoginAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

/**
 * Maps a validated invitation body to an insert payload.
 *
 * Five values are the **server's**, not the body's, and each of them is a decision:
 *
 * - `status` = `invited` (`E4`/`E10`): nothing has been accepted yet;
 * - `invitedAt` = the supplied instant, so the caller owns the clock;
 * - `invitedByOperatorId` = `null`: there is no session until AIS-73/74, and an
 *   invented operator id would be a lie in an FK-checked column (`E9`);
 * - `passwordHash` / `acceptedAt` / `lastLoginAt` = `null`: auth-owned (`E10`);
 * - `role` falls back to the contract default, so the function is safe to call
 *   with the *input* type as well, where the field is optional.
 *
 * @param customerId - the parent customer from the route.
 * @param input - validated invitation body.
 * @param invitedAt - the invitation instant.
 * @returns insert payload for `iam.customer_users`.
 */
export function toNewCustomerUserRow(
  customerId: string,
  input: InviteCustomerUserInput,
  invitedAt: Date,
): NewCustomerUserRow {
  return {
    customerId,
    name: input.name,
    email: input.email,
    passwordHash: null,
    role: input.role ?? CUSTOMER_USER_DEFAULT_ROLE,
    status: CUSTOMER_USER_INITIAL_STATUS,
    invitedByOperatorId: null,
    invitedAt,
    acceptedAt: null,
    lastLoginAt: null,
  };
}

/**
 * Maps a validated `PATCH …/customer-users/:customerUserId` body to the columns.
 *
 * `undefined` leaves a column alone — unlike the customer patch there is no
 * `null` case, because no writable user column is nullable.
 *
 * @param input - validated body.
 * @returns the columns to write; possibly empty.
 */
export function toCustomerUserPatch(
  input: UpdateCustomerUserInput,
): CustomerUserPatch {
  return {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.role === undefined ? {} : { role: input.role }),
    ...(input.status === undefined ? {} : { status: input.status }),
  };
}

/**
 * @param patch - the column subset built by {@link toCustomerUserPatch}.
 * @returns `true` when the request carried no writable field at all.
 */
export function hasCustomerUserPatch(patch: CustomerUserPatch): boolean {
  return Object.keys(patch).length > 0;
}

/**
 * Flattens a login-user row into the payload the audit diff compares.
 *
 * `passwordHash` is deliberately **not** part of the payload: the ledger is
 * readable by more roles than the credential ever should be, and a hash in a diff
 * would be a secret copied into an append-only table.
 *
 * @param row - the row as read or as written.
 * @returns a plain record of the business columns.
 */
export function toCustomerUserAuditPayload(
  row: CustomerUserRow,
): Readonly<Record<string, unknown>> {
  return {
    id: row.id,
    customerId: row.customerId,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    invitedByOperatorId: row.invitedByOperatorId,
    invitedAt: toNullableIsoString(row.invitedAt),
    acceptedAt: toNullableIsoString(row.acceptedAt),
    lastLoginAt: toNullableIsoString(row.lastLoginAt),
    createdAt: toIsoString(row.createdAt),
  };
}
