/**
 * Persistence contract of the customer-activities feature (AIS-178, slice f).
 *
 * The service depends on this interface only, which is what makes the service
 * spec a plain object mock — no Nest, no Drizzle, no socket. The implementation
 * owns the SQL; this file owns the *promises* the SQL makes.
 *
 * Contract for implementers:
 *
 * - **every read is scoped by the customer id** *and* by `deleted_at IS NULL`:
 *   the route nesting is the access boundary, and an archived entry is gone;
 * - {@link findAnyById} is the deliberate exception used *before* a write: it
 *   sees archived rows too, so the service can tell "absent" from "archived"
 *   from "changed meanwhile";
 * - a guarded write that matches no row answers `null` — the service decides
 *   whether that is `404` or `409 STALE_WRITE`; a no-op is never an error here;
 * - the guarded update compares the **last write instant**
 *   (`updated_at ?? created_at`) and always writes `updated_at = now`, because
 *   `activities.updated_at` is nullable and has no `$onUpdate` (AIS-178/f `F4`,
 *   `P9`).
 */

import type { ActivityListQuery } from '@callback/shared';
import type { DatabaseTransaction } from '../audit/audit-transaction.interface.js';
import type { ActivityRow, NewActivityRow } from '../db/schema.js';
import type {
  ActivityPage,
  ActivityPatch,
} from './customers-activities.interface.js';

export interface CustomerActivitiesRepository {
  /**
   * @param customerId - the parent customer.
   * @returns `true` when a **live** customer owns the id.
   */
  customerExists(customerId: string): Promise<boolean>;

  /**
   * Reads one page of the live feed.
   *
   * @param customerId - the customer whose feed is read.
   * @param query - the validated list query (`page`, `limit`, `order`).
   * @returns the rows of the page and the total of the whole result set, both
   *   produced from the **same** `WHERE`.
   */
  findPage(customerId: string, query: ActivityListQuery): Promise<ActivityPage>;

  /**
   * Reads one activity **without** the soft-delete filter.
   *
   * @param customerId - the parent customer (the access boundary).
   * @param activityId - the entry to read.
   * @returns the row, or `null` when this customer has no such entry.
   */
  findAnyById(
    customerId: string,
    activityId: string,
  ): Promise<ActivityRow | null>;

  /**
   * Inserts one activity and returns it as stored.
   *
   * @param tx - the transaction of the business write (and of its audit row).
   * @param input - insert payload, already normalised by the mapper.
   * @throws {import('./customers-activities.errors.js').ActivityRowMissingError}
   *   when `INSERT … RETURNING` yields no row.
   */
  create(tx: DatabaseTransaction, input: NewActivityRow): Promise<ActivityRow>;

  /**
   * Writes the given columns, guarded by the last write instant.
   *
   * The statement also sets `updated_at = now`, so the token of the next edit
   * has moved (`P9`). The guard compares `coalesce(updated_at, created_at)`, so
   * the **first** edit of a never-edited row is accepted with the `created_at`
   * token (`F4`).
   *
   * @param tx - the transaction of the business write.
   * @param customerId - the parent customer (the access boundary).
   * @param activityId - the entry to update.
   * @param patch - the columns to write (never empty: the service short-circuits).
   * @param expectedLastWrite - the instant the client echoed.
   * @param now - the new `updated_at`.
   * @returns the updated row, or `null` when the guard matched nothing.
   */
  updateById(
    tx: DatabaseTransaction,
    customerId: string,
    activityId: string,
    patch: ActivityPatch,
    expectedLastWrite: Date,
    now: Date,
  ): Promise<ActivityRow | null>;

  /**
   * Hides one live activity by setting `deleted_at`.
   *
   * @param tx - the transaction of the business write.
   * @param customerId - the parent customer (the access boundary).
   * @param activityId - the entry to hide.
   * @param deletedAt - the deletion instant.
   * @returns the row as written, or `null` when it was already gone.
   */
  softDeleteById(
    tx: DatabaseTransaction,
    customerId: string,
    activityId: string,
    deletedAt: Date,
  ): Promise<ActivityRow | null>;

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
