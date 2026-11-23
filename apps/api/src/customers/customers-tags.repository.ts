/**
 * Drizzle implementation of {@link CustomerTagsRepository} (AIS-178, slice e).
 *
 * This is the only file in the feature that builds SQL, and the only one that may
 * import Drizzle. It receives the shared `DATABASE` handle from `DatabaseModule`
 * (never creates a client) and translates exactly one failure mode into a domain
 * error: the catalogue's `tags_name_key`. Everything else is re-thrown untouched,
 * so a connection or permission problem is never disguised as a business answer.
 *
 * Two design notes a future editor should not "simplify" away:
 *
 * 1. **The link is written with `ON CONFLICT DO NOTHING`.** `customer_tags` has a
 *    composite primary key and no soft-delete column, so "attach" is naturally
 *    idempotent — turning the repeat into a `23505` would make the endpoint fail
 *    on a second click for no reason (AIS-178/e `E8`).
 * 2. **`detach` never deletes the catalogue row.** One customer leaving a label
 *    must not remove it from every other customer (AIS-178/e `E11`).
 */

import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { DatabaseTransaction } from '../audit/audit-transaction.interface.js';
import { DATABASE } from '../db/database.const.js';
import type { Database } from '../db/database.interface.js';
import { customerTags, customers, tags } from '../db/schema.js';
import type { NewTagRow, TagRow } from '../db/schema.js';
import { customerNotDeletedFilter } from './customers.filter.js';
import { isTagNameConflict } from './customers-tags.error-guard.js';
import {
  TagNameRaceError,
  TagRowMissingError,
} from './customers-tags.errors.js';
import type { CustomerTagsRepository } from './customers-tags.repository.interface.js';

/**
 * Postgres-backed storage for `customer.tags` and `customer.customer_tags`.
 *
 * @example
 * ```ts
 * const repository = new DrizzleCustomerTagsRepository(db);
 * const tag = await repository.findTagByName('vip');
 * ```
 */
@Injectable()
export class DrizzleCustomerTagsRepository implements CustomerTagsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** {@inheritDoc CustomerTagsRepository.customerExists} */
  async customerExists(customerId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, customerId), customerNotDeletedFilter()))
      .limit(1);

    return rows.length > 0;
  }

  /** {@inheritDoc CustomerTagsRepository.findTagByName} */
  async findTagByName(name: string): Promise<TagRow | null> {
    const rows = await this.db
      .select()
      .from(tags)
      .where(eq(tags.name, name))
      .limit(1);

    return rows[0] ?? null;
  }

  /** {@inheritDoc CustomerTagsRepository.findTagById} */
  async findTagById(tagId: string): Promise<TagRow | null> {
    const rows = await this.db
      .select()
      .from(tags)
      .where(eq(tags.id, tagId))
      .limit(1);

    return rows[0] ?? null;
  }

  /** {@inheritDoc CustomerTagsRepository.insertTag} */
  async insertTag(tx: DatabaseTransaction, input: NewTagRow): Promise<TagRow> {
    let rows: TagRow[];

    try {
      rows = await tx.insert(tags).values(input).returning();
    } catch (error) {
      throw isTagNameConflict(error)
        ? new TagNameRaceError(input.name, error)
        : error;
    }

    const [row] = rows;

    if (row === undefined) {
      throw new TagRowMissingError(null);
    }

    return row;
  }

  /** {@inheritDoc CustomerTagsRepository.attach} */
  async attach(
    tx: DatabaseTransaction,
    customerId: string,
    tagId: string,
  ): Promise<boolean> {
    const rows = await tx
      .insert(customerTags)
      .values({ customerId, tagId })
      .onConflictDoNothing()
      .returning({ tagId: customerTags.tagId });

    return rows.length > 0;
  }

  /** {@inheritDoc CustomerTagsRepository.detach} */
  async detach(
    tx: DatabaseTransaction,
    customerId: string,
    tagId: string,
  ): Promise<boolean> {
    const rows = await tx
      .delete(customerTags)
      .where(
        and(
          eq(customerTags.customerId, customerId),
          eq(customerTags.tagId, tagId),
        ),
      )
      .returning({ tagId: customerTags.tagId });

    return rows.length > 0;
  }

  /** {@inheritDoc CustomerTagsRepository.runInTransaction} */
  async runInTransaction<T>(
    work: (tx: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) => work(tx));
  }
}
