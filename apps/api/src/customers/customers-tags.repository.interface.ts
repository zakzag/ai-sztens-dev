/**
 * Persistence contract of the customer-tags feature (AIS-178, slice e).
 *
 * The service depends on this interface only, which is what makes the service
 * spec a plain object mock — no Nest, no Drizzle, no socket. The implementation
 * owns the SQL; this file owns the *promises* the SQL makes.
 *
 * Contract for implementers:
 *
 * - **every link read and write is scoped by the customer id**: `customer_tags`
 *   has no id of its own, so `(customer_id, tag_id)` is the address;
 * - {@link attach} and {@link detach} answer **whether a row changed**, and a
 *   no-op is success, not an error: an attach of an already attached label and a
 *   detach of an absent link are both reported as `false` (the service turns the
 *   second into `404`);
 * - a duplicate label name is reported as {@link TagNameRaceError} so the service
 *   can reuse the winner's row; **every other** failure is propagated unchanged.
 */

import type { DatabaseTransaction } from '../audit/audit-transaction.interface.js';
import type { NewTagRow, TagRow } from '../db/schema.js';

export interface CustomerTagsRepository {
  /**
   * @param customerId - the parent customer.
   * @returns `true` when a **live** customer owns the id.
   */
  customerExists(customerId: string): Promise<boolean>;

  /**
   * Reads a catalogue row by its exact name.
   *
   * The comparison is case-sensitive because `tags_name_key` is: `vip` and `VIP`
   * are two labels, and pretending otherwise here would let the service attach a
   * label the index considers different.
   *
   * @param name - the validated, trimmed name.
   * @returns the row, or `null` when the catalogue has no such label.
   */
  findTagByName(name: string): Promise<TagRow | null>;

  /**
   * @param tagId - the label to read (validated as a uuid before this layer).
   * @returns the row, or `null` when it does not exist.
   */
  findTagById(tagId: string): Promise<TagRow | null>;

  /**
   * Inserts one catalogue row and returns it as stored.
   *
   * @param tx - the transaction of the business write (and of its audit row).
   * @param input - insert payload, already normalised by the mapper.
   * @throws {import('./customers-tags.errors.js').TagNameRaceError} when a
   *   concurrent request created the same name first.
   * @throws {import('./customers-tags.errors.js').TagRowMissingError} when
   *   `INSERT … RETURNING` yields no row.
   */
  insertTag(tx: DatabaseTransaction, input: NewTagRow): Promise<TagRow>;

  /**
   * Creates the `customer_tags` link unless it already exists.
   *
   * One statement — `INSERT … ON CONFLICT DO NOTHING RETURNING` — so a concurrent
   * double attach cannot produce a `23505` for the caller: the second writer
   * simply reports `false` (AIS-178/e `E8`).
   *
   * @param tx - the transaction of the business write.
   * @param customerId - the customer holding the link.
   * @param tagId - the label to attach.
   * @returns `true` when the link was created by **this** call.
   */
  attach(
    tx: DatabaseTransaction,
    customerId: string,
    tagId: string,
  ): Promise<boolean>;

  /**
   * Removes the `customer_tags` link. The `tags` row is never touched.
   *
   * @param tx - the transaction of the business write.
   * @param customerId - the customer holding the link.
   * @param tagId - the label to detach.
   * @returns `true` when a link existed and was removed.
   */
  detach(
    tx: DatabaseTransaction,
    customerId: string,
    tagId: string,
  ): Promise<boolean>;

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
