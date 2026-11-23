/**
 * Persistence contract of the customer-contacts feature (AIS-178, slice d).
 *
 * The service depends on this interface only, which is what makes the service
 * spec a plain object mock — no Nest, no Drizzle, no socket. The implementation
 * owns the SQL; this file owns the *promises* the SQL makes.
 *
 * Contract for implementers:
 *
 * - **every read is scoped by the customer id**, not only by the contact id: a
 *   contact is addressable only inside its own customer, so guessing a uuid can
 *   never cross that boundary;
 * - a soft-deleted contact answers `null`, exactly like a row that never existed;
 * - a duplicate `primary` role is reported as `PrimaryContactConflictError`, a
 *   foreign `customerUserId` as `ContactUserMismatchError`, and **every other**
 *   failure is propagated unchanged so the original stack survives;
 * - every **write** takes the caller's transaction handle, so the role rows, the
 *   contact row and their ledger rows commit together.
 */

import type { ListQuery } from '@callback/shared';
import type { DatabaseTransaction } from '../audit/audit-transaction.interface.js';
import type {
  ContactRoleRow,
  ContactRow,
  NewContactRow,
} from '../db/schema.js';
import type { ContactWithRoles } from './customers.interface.js';
import type {
  ContactPage,
  ContactPatch,
} from './customers-contacts.interface.js';

export interface CustomerContactsRepository {
  /**
   * @param customerId - the parent customer.
   * @returns `true` when a **live** customer owns the id.
   */
  customerExists(customerId: string): Promise<boolean>;

  /**
   * Returns one page of live contacts plus the total count.
   *
   * The order is `name` in the requested direction, with `id` as the tie-breaker:
   * two contacts sharing a name would otherwise swap places between two requests
   * and a page boundary could skip or repeat a row.
   *
   * @param customerId - the parent customer.
   * @param query - the validated list query (paging + the `q` search term).
   * @returns the page (each contact with its roles) and the total.
   */
  findPage(customerId: string, query: ListQuery): Promise<ContactPage>;

  /**
   * Reads one **live** contact of the customer, with its roles.
   *
   * @param customerId - the parent customer.
   * @param contactId - the contact's uuid (both validated before this layer).
   * @returns the contact with its role set, or `null` when it is unknown,
   *   archived, or belongs to another customer.
   */
  findById(
    customerId: string,
    contactId: string,
  ): Promise<ContactWithRoles | null>;

  /**
   * Reads a contact **including archived ones**, without roles.
   *
   * Exists only to classify a guarded write: an update returns `null` for three
   * different situations (absent, archived, stale), and the caller needs one extra
   * read to answer `404` or `409 STALE_WRITE`.
   *
   * @param customerId - the parent customer.
   * @param contactId - the contact's uuid.
   * @returns the row whichever state it is in, or `null` when it never existed.
   */
  findAnyById(
    customerId: string,
    contactId: string,
  ): Promise<ContactRow | null>;

  /**
   * @param contactId - the contact whose role rows are read.
   * @returns the stored role rows, in query order (possibly empty).
   */
  findRoles(contactId: string): Promise<readonly ContactRoleRow[]>;

  /**
   * Inserts one contact and returns it as stored.
   *
   * @param tx - the transaction of the business write (and of its audit row).
   * @param input - insert payload, already normalised by the mapper.
   * @throws {import('./customers-contacts.errors.js').ContactUserMismatchError}
   *   when the `customerUserId` points outside this customer.
   * @throws {import('./customers-contacts.errors.js').ContactRowMissingError}
   *   when `INSERT … RETURNING` yields no row.
   */
  create(tx: DatabaseTransaction, input: NewContactRow): Promise<ContactRow>;

  /**
   * Writes the given columns, but only if the stored version still matches.
   *
   * One atomic statement — `WHERE id = … AND customer_id = … AND deleted_at IS
   * NULL AND updated_at = expected` — so there is no window between a read and
   * the write in which another writer could slip in.
   *
   * @param tx - the transaction of the business write.
   * @param customerId - the parent customer (part of the address).
   * @param contactId - the row to update.
   * @param patch - the columns to write; must be **non-empty** (the service
   *   short-circuits an empty patch before reaching this method).
   * @param expectedUpdatedAt - the version the client last saw; compared, never
   *   written.
   * @returns the updated row, or `null` when nothing matched.
   * @throws {import('./customers-contacts.errors.js').ContactUserMismatchError}
   *   when the new `customerUserId` points outside this customer.
   */
  updateById(
    tx: DatabaseTransaction,
    customerId: string,
    contactId: string,
    patch: ContactPatch,
    expectedUpdatedAt: Date,
  ): Promise<ContactRow | null>;

  /**
   * Marks a live contact as archived and returns it.
   *
   * @param tx - the transaction of the business write.
   * @param customerId - the parent customer (part of the address).
   * @param contactId - the row to hide.
   * @param deletedAt - deletion timestamp, injected so the caller owns the clock.
   * @returns the row as stored after the write, or `null` when no live row
   *   matched (absent, already archived, or another customer's contact).
   */
  softDeleteById(
    tx: DatabaseTransaction,
    customerId: string,
    contactId: string,
    deletedAt: Date,
  ): Promise<ContactRow | null>;

  /**
   * Replaces the whole role set of a contact.
   *
   * A delete-then-insert pair inside the caller's transaction, which is what
   * makes "move the primary flag" one atomic write instead of two racing ones.
   *
   * @param tx - the transaction of the business write.
   * @param contactId - the contact whose roles are replaced.
   * @param customerId - its customer (denormalised into every role row).
   * @param roles - the new role set; an empty array clears the roles.
   * @throws {import('./customers-contacts.errors.js').PrimaryContactConflictError}
   *   when another live contact already holds `primary`.
   */
  replaceRoles(
    tx: DatabaseTransaction,
    contactId: string,
    customerId: string,
    roles: readonly import('@callback/shared').ContactRole[],
  ): Promise<void>;

  /**
   * Drops every role row of a contact.
   *
   * Separate from {@link softDeleteById} because the two are different facts: the
   * contact row survives (with `deleted_at`), its roles do not — `contact_roles`
   * has no soft-delete column on purpose (AIS-18), so a lingering row would keep
   * the `primary` slot occupied forever.
   *
   * @param tx - the transaction of the business write.
   * @param contactId - the contact whose role rows are removed.
   */
  deleteRoles(tx: DatabaseTransaction, contactId: string): Promise<void>;

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
