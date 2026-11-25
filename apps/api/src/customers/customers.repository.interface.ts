/**
 * Persistence contract of the `customers` feature (AIS-178).
 *
 * The service depends on this interface only (plan `D2`), which is what makes
 * the service spec a plain object mock — no Nest, no Drizzle, no socket. The
 * implementation owns the SQL; this file owns the *promises* the SQL makes.
 *
 * Contract for implementers:
 * - return rows / `null`, never HTTP concepts — no `@nestjs/common` import here
 *   or in the implementation;
 * - a duplicate `customer_number` / `tax_number` is reported as the matching
 *   domain error, every other failure is propagated unchanged so the original
 *   stack survives;
 * - every **write** takes the caller's transaction handle, so the audit row and
 *   the business row commit together (AIS-177 `D2`).
 *
 * Why the writes take `tx` and the reads do not: a read has nothing to commit,
 * and forcing a transaction around it would make a list query open one
 * connection more than it needs. The one read that *must* be inside the write
 * transaction is {@link nextCustomerNumber}, because the number allocation is
 * only meaningful together with the insert it feeds.
 */

import type { CustomerListQuery } from '@callback/shared';
import type { DatabaseTransaction } from '../audit/audit-transaction.interface.js';
import type { CustomerRow, NewCustomerRow } from '../db/schema.js';
import type {
  CustomerDetailRows,
  CustomerListRow,
  CustomerPatch,
  CustomerStatusPatch,
} from './customers.interface.js';

/**
 * One page of customers plus the size of the whole result set.
 *
 * `total` is counted with a second query over the **same** filter, so the
 * client's pager can compute `totalPages` without walking the table itself.
 */
export interface CustomerPage {
  /** The rows of the requested page with their derived projections. */
  readonly rows: readonly CustomerListRow[];

  /** Matching rows across all pages. */
  readonly total: number;
}

export interface CustomersRepository {
  /**
   * Returns one page of customers plus the total count.
   *
   * The order is **always** deterministic: the requested column first, then
   * `id` as the tie-breaker. Without the tie-breaker two rows sharing a
   * timestamp could swap places between two requests and a page boundary would
   * silently skip or repeat a row.
   *
   * Every filter of the validated query is **applied**, not ignored: the
   * contract accepts the field, so a silently unfiltered list would be a lie the
   * client cannot see.
   *
   * @param query - the validated list query (paging, sort, search, filters).
   * @returns the page and the total number of matching rows.
   */
  findPage(query: CustomerListQuery): Promise<CustomerPage>;

  /**
   * Reads one **live** customer with its tags, contacts (and their roles) and
   * login users.
   *
   * “Live” is part of the contract: a soft-deleted row answers `null`, so the
   * service's “not found” answer and the repository's answer agree without the
   * service re-checking `deletedAt`.
   *
   * @param id - the customer's uuid (validated before it reaches this layer).
   * @returns the parent with its children, or `null` when there is no live row.
   */
  findById(id: string): Promise<CustomerDetailRows | null>;

  /**
   * Reads a row **including deleted ones**, without children.
   *
   * Exists only to classify a failed guarded write: an update returns `null` for
   * three different situations (absent, deleted, stale), and the caller needs one
   * extra read to tell them apart and answer `404` or `409 STALE_WRITE`.
   *
   * @param id - the customer's uuid.
   * @returns the row whichever state it is in, or `null` when it never existed.
   */
  findAnyById(id: string): Promise<CustomerRow | null>;

  /**
   * Inserts one row and returns it as stored.
   *
   * @param tx - the transaction of the business write (and of its audit row).
   * @param input - insert payload, already normalised by the mapper.
   * @returns the persisted row **without** the derived projections (a fresh row
   *   has none; the service completes it).
   * @throws {import('./customers.errors.js').CustomerNumberConflictError} when
   *   `customer_number` already exists.
   * @throws {import('./customers.errors.js').CustomerTaxNumberConflictError}
   *   when a live row already owns `tax_number`.
   * @throws {import('./customers.errors.js').CustomerRowMissingError} when
   *   `INSERT … RETURNING` yields no row.
   */
  create(tx: DatabaseTransaction, input: NewCustomerRow): Promise<CustomerRow>;

  /**
   * Writes the given columns, but only if the stored version still matches.
   *
   * One atomic statement — `WHERE id = … AND deleted_at IS NULL AND updated_at =
   * expected` — so there is no window between a read and the write in which
   * another writer could slip in. A read-compare-write in the service would
   * reintroduce exactly the lost update this method exists to prevent.
   *
   * @param tx - the transaction of the business write.
   * @param id - the row to update (the address, never patched).
   * @param patch - the columns to write; absent keys are **left untouched**.
   * @param expectedUpdatedAt - the version the client last saw; compared, never
   *   written.
   * @returns the updated row, or `null` when nothing matched (absent, deleted
   *   or a different version — the caller classifies which).
   * @throws {import('./customers.errors.js').CustomerTaxNumberConflictError}
   *   when a live row already owns the new `tax_number`.
   */
  updateById(
    tx: DatabaseTransaction,
    id: string,
    patch: CustomerPatch,
    expectedUpdatedAt: Date,
  ): Promise<CustomerRow | null>;

  /**
   * Writes `status` and `status_changed_at` together, guarded by `updated_at`.
   *
   * A method of its own rather than a call to {@link updateById} with a widened
   * patch: the pair is a different operation (it has its own endpoint and its
   * own audit shape), and `status_changed_at` must never be writable by the
   * general edit.
   *
   * @param tx - the transaction of the business write.
   * @param id - the row whose status changes.
   * @param patch - the two columns, from the pure `toStatusPatch()`.
   * @param expectedUpdatedAt - the version the client last saw.
   * @returns the updated row, or `null` when nothing matched.
   */
  updateStatusById(
    tx: DatabaseTransaction,
    id: string,
    patch: CustomerStatusPatch,
    expectedUpdatedAt: Date,
  ): Promise<CustomerRow | null>;

  /**
   * Marks a live row as archived and returns it.
   *
   * @param tx - the transaction of the business write.
   * @param id - the row to hide.
   * @param deletedAt - deletion timestamp, injected so the caller (and tests)
   *   own the clock.
   * @returns the row as stored after the write, or `null` when no live row
   *   matched (absent, or already deleted — both are a `404` for the caller).
   */
  softDeleteById(
    tx: DatabaseTransaction,
    id: string,
    deletedAt: Date,
  ): Promise<CustomerRow | null>;

  /**
   * Returns the highest `customer_number` of one month, inside the transaction.
   *
   * Deliberately **not** filtered on `deleted_at`: the number's unique
   * constraint is plain, so an archived customer keeps its number and the next
   * allocation must continue after it.
   *
   * **The read is serialised per month.** The implementation takes a
   * transaction-scoped advisory lock on the prefix before reading `max()`, so
   * two concurrent creates cannot derive the same next number. Reading the
   * maximum "where it will be used" is not enough on its own: under READ
   * COMMITTED both transactions see the pre-insert state, and the loser's
   * unique violation aborts its whole unit of work.
   *
   * @param tx - the write transaction (the `max()` must be read where it will be
   *   used, and under the allocation lock).
   * @param prefix - the month prefix, e.g. `AIS-202611-`.
   * @returns the stored maximum, or `null` when the month is empty.
   */
  nextCustomerNumber(
    tx: DatabaseTransaction,
    prefix: string,
  ): Promise<string | null>;

  /**
   * Runs `work` inside one database transaction and returns its result.
   *
   * The service composes “business row write → `AuditWriter.write`” inside it,
   * which is why the transaction is opened here and not by the caller: the
   * service never sees `db.transaction`, so the ORM cannot leak into the
   * orchestration layer, while the audit row still cannot land outside the
   * business write.
   *
   * @param work - the unit of work; it receives the transaction handle.
   * @returns whatever `work` returned, after the commit.
   */
  runInTransaction<T>(
    work: (tx: DatabaseTransaction) => Promise<T>,
  ): Promise<T>;
}
