/**
 * Persistence contract of the customer-user feature (AIS-178, slice e).
 *
 * The service depends on this interface only, which is what makes the service
 * spec a plain object mock — no Nest, no Drizzle, no socket. The implementation
 * owns the SQL; this file owns the *promises* the SQL makes.
 *
 * Contract for implementers:
 *
 * - **every read and write is scoped by the customer id**, not only by the user
 *   id: a login user is addressable only inside its own customer, so guessing a
 *   uuid can never cross that boundary;
 * - a duplicate e-mail is reported as `CustomerUserEmailConflictError`, a second
 *   active owner as `CustomerOwnerConflictError`, a still-referenced row as
 *   `CustomerUserInUseError`, and **every other** failure is propagated unchanged
 *   so the original stack survives;
 * - every **write** takes the caller's transaction handle, so the row and its
 *   ledger entry commit together.
 */

import type { DatabaseTransaction } from '../audit/audit-transaction.interface.js';
import type { CustomerUserRow, NewCustomerUserRow } from '../db/schema.js';
import type { CustomerUserPatch } from './customers-users.interface.js';

export interface CustomerUsersRepository {
  /**
   * @param customerId - the parent customer.
   * @returns `true` when a **live** customer owns the id.
   */
  customerExists(customerId: string): Promise<boolean>;

  /**
   * Reads one login user of the customer.
   *
   * There is no `deleted_at` on `iam.customer_users`, so "absent" is the only
   * miss: deactivating a user keeps the row on purpose (the `status` column is
   * the lifecycle, and a contact may still point at the user).
   *
   * @param customerId - the parent customer.
   * @param customerUserId - the user's uuid (both validated before this layer).
   * @returns the row, or `null` when it is unknown or belongs to another
   *   customer.
   */
  findById(
    customerId: string,
    customerUserId: string,
  ): Promise<CustomerUserRow | null>;

  /**
   * Inserts one login user and returns it as stored.
   *
   * @param tx - the transaction of the business write (and of its audit row).
   * @param input - insert payload, already normalised by the mapper.
   * @throws {import('./customers-users.errors.js').CustomerUserEmailConflictError}
   *   when the address already holds a login anywhere.
   * @throws {import('./customers-users.errors.js').CustomerUserRowMissingError}
   *   when `INSERT … RETURNING` yields no row.
   */
  insert(
    tx: DatabaseTransaction,
    input: NewCustomerUserRow,
  ): Promise<CustomerUserRow>;

  /**
   * Writes the given columns, but only if the stored version still matches.
   *
   * One atomic statement — `WHERE id = … AND customer_id = … AND updated_at =
   * expected` — so there is no window between a read and the write in which
   * another writer could slip in. There is no `deleted_at` branch: the table has
   * no such column.
   *
   * @param tx - the transaction of the business write.
   * @param customerId - the parent customer (part of the address).
   * @param customerUserId - the row to update.
   * @param patch - the columns to write; must be **non-empty** (the service
   *   short-circuits an empty patch before reaching this method).
   * @param expectedUpdatedAt - the version the client last saw; compared, never
   *   written.
   * @returns the updated row, or `null` when nothing matched.
   * @throws {import('./customers-users.errors.js').CustomerOwnerConflictError}
   *   when the write would create a second active owner.
   */
  updateById(
    tx: DatabaseTransaction,
    customerId: string,
    customerUserId: string,
    patch: CustomerUserPatch,
    expectedUpdatedAt: Date,
  ): Promise<CustomerUserRow | null>;

  /**
   * Deletes one login user and returns the row it removed.
   *
   * A **hard** delete, because the table has no soft-delete column: the only
   * deletable state is `invited` (enforced by the service), and an invitation
   * that was never accepted has no history worth keeping beyond the ledger row.
   *
   * @param tx - the transaction of the business write.
   * @param customerId - the parent customer (part of the address).
   * @param customerUserId - the row to remove.
   * @returns the removed row, or `null` when no row matched.
   * @throws {import('./customers-users.errors.js').CustomerUserInUseError} when a
   *   contact or an activity still references the row.
   */
  deleteById(
    tx: DatabaseTransaction,
    customerId: string,
    customerUserId: string,
  ): Promise<CustomerUserRow | null>;

  /**
   * Runs `work` inside one database transaction and returns its result.
   *
   * @param work - the unit of work; it receives the transaction handle.
   * @returns whatever `work` returned, after the commit.
   */
  runInTransaction<T>(
    work: (tx: DatabaseTransaction) => Promise<T>,
  ): Promise<T>;
}
