/**
 * Drizzle implementation of {@link CustomerActivitiesRepository} (AIS-178, slice f).
 *
 * This is the only file in the feature that builds SQL, and the only one that may
 * import Drizzle. It receives the shared `DATABASE` handle from `DatabaseModule`
 * (never creates a client) and classifies **no** failure mode: the feed has no
 * unique index and no foreign key a client can violate, so every error is
 * propagated untouched and stays a `500` instead of being disguised as a business
 * answer.
 *
 * Two design notes a future editor should not "simplify" away:
 *
 * 1. **The guard compares the last write instant, not the column.**
 *    `activities.updated_at` is nullable and `< row>` means "never edited", so
 *    `updated_at = $expected` would reject the *first* edit of every entry.
 *    `coalesce(updated_at, created_at) = $expected` accepts exactly the instant
 *    the client was shown (`F4`).
 * 2. **`updated_at` is written explicitly.** The column has no `$onUpdate`, so a
 *    patch that skipped it would freeze the token forever (`P9`).
 */

import { Inject, Injectable } from '@nestjs/common';
import type { ActivityListQuery } from '@callback/shared';
import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { DatabaseTransaction } from '../audit/audit-transaction.interface.js';
import { DATABASE } from '../db/database.const.js';
import type { Database } from '../db/database.interface.js';
import { activities, customers } from '../db/schema.js';
import type { ActivityRow, NewActivityRow } from '../db/schema.js';
import { customerNotDeletedFilter } from './customers.filter.js';
import { ActivityRowMissingError } from './customers-activities.errors.js';
import { activityVisibleFilter } from './customers-activities.filter.js';
import type {
  ActivityPage,
  ActivityPatch,
} from './customers-activities.interface.js';
import type { CustomerActivitiesRepository } from './customers-activities.repository.interface.js';

/**
 * Postgres-backed storage for `activity.activities`.
 *
 * @example
 * ```ts
 * const repository = new DrizzleCustomerActivitiesRepository(db);
 * const page = await repository.findPage(customerId, query);
 * ```
 */
@Injectable()
export class DrizzleCustomerActivitiesRepository implements CustomerActivitiesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** {@inheritDoc CustomerActivitiesRepository.customerExists} */
  async customerExists(customerId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, customerId), customerNotDeletedFilter()))
      .limit(1);

    return rows.length > 0;
  }

  /** {@inheritDoc CustomerActivitiesRepository.findPage} */
  async findPage(
    customerId: string,
    query: ActivityListQuery,
  ): Promise<ActivityPage> {
    // One expression for the count and the page query, so the two can never
    // disagree about the result set.
    const where = activityVisibleFilter(customerId);

    const [counted, rows] = await Promise.all([
      this.db.select({ total: count() }).from(activities).where(where),
      this.db
        .select()
        .from(activities)
        .where(where)
        .orderBy(
          query.order === 'asc'
            ? asc(activities.createdAt)
            : desc(activities.createdAt),
          // The tie-breaker of `F9`: two entries of the same millisecond keep a
          // stable order across pages, because the uuid is deterministic per row.
          asc(activities.id),
        )
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
    ]);

    return {
      rows,
      total: Number(counted[0]?.total ?? 0),
    };
  }

  /** {@inheritDoc CustomerActivitiesRepository.findAnyById} */
  async findAnyById(
    customerId: string,
    activityId: string,
  ): Promise<ActivityRow | null> {
    // No `deleted_at` filter: this read exists to tell "absent" from "archived"
    // from "stale" for a write that matched nothing.
    const rows = await this.db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.customerId, customerId),
          eq(activities.id, activityId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  /** {@inheritDoc CustomerActivitiesRepository.create} */
  async create(
    tx: DatabaseTransaction,
    input: NewActivityRow,
  ): Promise<ActivityRow> {
    const rows = await tx.insert(activities).values(input).returning();
    const [row] = rows;

    if (row === undefined) {
      throw new ActivityRowMissingError(null);
    }

    return row;
  }

  /** {@inheritDoc CustomerActivitiesRepository.updateById} */
  async updateById(
    tx: DatabaseTransaction,
    customerId: string,
    activityId: string,
    patch: ActivityPatch,
    expectedLastWrite: Date,
    now: Date,
  ): Promise<ActivityRow | null> {
    const rows = await tx
      .update(activities)
      .set({ ...patch, updatedAt: now })
      .where(
        and(
          eq(activities.id, activityId),
          eq(activities.customerId, customerId),
          isNull(activities.deletedAt),
          // `updated_at ?? created_at`, in SQL: the token of a never-edited row
          // is its creation instant (`F4`).
          sql`coalesce(${activities.updatedAt}, ${activities.createdAt}) = ${expectedLastWrite}`,
        ),
      )
      .returning();

    return rows[0] ?? null;
  }

  /** {@inheritDoc CustomerActivitiesRepository.softDeleteById} */
  async softDeleteById(
    tx: DatabaseTransaction,
    customerId: string,
    activityId: string,
    deletedAt: Date,
  ): Promise<ActivityRow | null> {
    const rows = await tx
      .update(activities)
      .set({ deletedAt })
      .where(
        and(
          eq(activities.id, activityId),
          eq(activities.customerId, customerId),
          isNull(activities.deletedAt),
        ),
      )
      .returning();

    return rows[0] ?? null;
  }

  /** {@inheritDoc CustomerActivitiesRepository.runInTransaction} */
  async runInTransaction<T>(
    work: (tx: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) => work(tx));
  }
}
