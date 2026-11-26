/**
 * Server-side view types of the customer-user feature (AIS-178, slice e).
 *
 * The wire contract lives in `@callback/shared` (`CustomerUser`); what is declared
 * here is the column subset a `PATCH` may write. Nothing here is a second copy of
 * a contract type.
 */

import type { CustomerUserRole, CustomerUserStatus } from '@callback/shared';

/**
 * The column subset `PATCH /:id/customer-users/:customerUserId` may write.
 *
 * Three families are deliberately absent, and all three are type-level guarantees
 * rather than review notes:
 *
 * - `id`, `customerId`, `createdAt` — server-owned identity;
 * - `updatedAt` — the optimistic-concurrency token is only ever **compared**,
 *   never written (the column is maintained by `$onUpdate`);
 * - `passwordHash`, `acceptedAt`, `lastLoginAt` — auth-owned columns. Accepting an
 *   invitation is AIS-73/74's job; an operator edits the *record*, not the
 *   credential (AIS-178/e `E10`).
 *
 * Every field is optional in the `undefined` sense: an absent key means "leave the
 * column untouched". None of them is nullable in the database, so a `null` is not
 * expressible here either.
 */
export interface CustomerUserPatch {
  readonly name?: string;
  readonly role?: CustomerUserRole;
  readonly status?: CustomerUserStatus;
}
