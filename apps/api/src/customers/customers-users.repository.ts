/**
 * Drizzle implementation of {@link CustomerUsersRepository} (AIS-178, slice e).
 *
 * This is the only file in the feature that builds SQL, and the only one that may
 * import Drizzle. It receives the shared `DATABASE` handle from `DatabaseModule`
 * (never creates a client) and translates exactly three failure modes into domain
 * errors: the global e-mail index, the partial owner index and the two foreign
 * keys that keep a referenced user alive. Everything else is re-thrown untouched,
 * so a connection or permission problem is never disguised as a business answer.
 *
 * Two design notes a future editor should not "simplify" away:
 *
 * 1. **Every statement is scoped by `customer_id`.** The route nesting is not
 *    decoration: it is the access boundary, so a user of customer A must not be
 *    reachable with customer B's id even if the uuid leaks.
 * 2. **The owner conflict is classified, never pre-checked.** The index is partial
 *    (`role = 'owner' AND status = 'active'`), so only the database can decide —
 *    a pre-check would have to repeat the predicate and would still race.
 */

import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { DatabaseTransaction } from '../audit/audit-transaction.interface.js';
import { DATABASE } from '../db/database.const.js';
import type { Database } from '../db/database.interface.js';
import { customerUsers, customers } from '../db/schema.js';
import type { CustomerUserRow, NewCustomerUserRow } from '../db/schema.js';
import { customerNotDeletedFilter } from './customers.filter.js';
import {
  isCustomerOwnerConflict,
  isCustomerUserEmailConflict,
  isCustomerUserInUse,
} from './customers-users.error-guard.js';
import {
  CustomerOwnerConflictError,
  CustomerUserEmailConflictError,
  CustomerUserInUseError,
  CustomerUserRowMissingError,
} from './customers-users.errors.js';
import type { CustomerUserPatch } from './customers-users.interface.js';
import type { CustomerUsersRepository } from './customers-users.repository.interface.js';

/**
 * Postgres-backed storage for `iam.customer_users`.
 *
 * @example
 * ```ts
 * const repository = new DrizzleCustomerUsersRepository(db);
 * const user = await repository.findById(customerId,  userId);
 * ```
 */
@Injectable()
export class DrizzleCustomerUsersRepository implements CustomerUsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** {@inheritDoc CustomerUsersRepository.customerExists} */
  async customerExists(customerId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, customerId), customerNotDeletedFilter()))
      .limit(1);

    return rows.length > 0;
  }

  /** {@inheritDoc CustomerUsersRepository.findById} */
  async findById(
    customerId: string,
    customerUserId: string,
  ): Promise<CustomerUserRow | null> {
    const rows = await this.db
      .select()
      .from(customerUsers)
      .where(
        and(
          eq(customerUsers.customerId, customerId),
          eq(customerUsers.id, customerUserId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  /** {@inheritDoc CustomerUsersRepository.insert} */
  async insert(
    tx: DatabaseTransaction,
    input: NewCustomerUserRow,
  ): Promise<CustomerUserRow> {
    let rows: CustomerUserRow[];

    try {
      rows = await tx.insert(customerUsers).values(input).returning();
    } catch (error) {
      throw isCustomerUserEmailConflict(error)
        ? new CustomerUserEmailConflictError(input.email, error)
        : error;
    }

    const [row] = rows;

    if (row === undefined) {
      throw new CustomerUserRowMissingError(null);
    }

    return row;
  }

  /** {@inheritDoc CustomerUsersRepository.updateById} */
  async updateById(
    tx: DatabaseTransaction,
    customerId: string,
    customerUserId: string,
    patch: CustomerUserPatch,
    expectedUpdatedAt: Date,
  ): Promise<CustomerUserRow | null> {
    try {
      const rows = await tx
        .update(customerUsers)
        .set(patch)
        .where(
          and(
            eq(customerUsers.id, customerUserId),
            eq(customerUsers.customerId, customerId),
            eq(customerUsers.updatedAt, expectedUpdatedAt),
          ),
        )
        .returning();

      return rows[0] ?? null;
    } catch (error) {
      throw isCustomerOwnerConflict(error)
        ? new CustomerOwnerConflictError(customerId, error)
        : error;
    }
  }

  /** {@inheritDoc CustomerUsersRepository.deleteById} */
  async deleteById(
    tx: DatabaseTransaction,
    customerId: string,
    customerUserId: string,
  ): Promise<CustomerUserRow | null> {
    try {
      const rows = await tx
        .delete(customerUsers)
        .where(
          and(
            eq(customerUsers.id, customerUserId),
            eq(customerUsers.customerId, customerId),
          ),
        )
        .returning();

      return rows[0] ?? null;
    } catch (error) {
      throw isCustomerUserInUse(error)
        ? new CustomerUserInUseError(customerUserId, error)
        : error;
    }
  }

  /** {@inheritDoc CustomerUsersRepository.runInTransaction} */
  async runInTransaction<T>(
    work: (tx: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) => work(tx));
  }
}
