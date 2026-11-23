/**
 * Drizzle implementation of {@link CustomerContactsRepository} (AIS-178, slice d).
 *
 * This is the only file in the feature that builds SQL, and the only one that may
 * import Drizzle. It receives the shared `DATABASE` handle from `DatabaseModule`
 * (never creates a client) and translates exactly two failure modes into domain
 * errors: the `primary` uniqueness index and the composite user foreign key.
 * Everything else is re-thrown untouched, so a connection or permission problem is
 * never disguised as a business answer.
 *
 * Two design notes a future editor should not "simplify" away:
 *
 * 1. **Every read is scoped by `customer_id`.** The route nesting is not
 *    decoration: it is the access boundary, so a contact of customer A must not be
 *    reachable with customer B's id even if the contact uuid leaks.
 * 2. **The page and the role rows are two queries.** A `LEFT JOIN` with `LIMIT`
 *    would cut a contact's roles off at the page boundary, because Postgres limits
 *    *joined rows*, not contacts.
 */

import { Inject, Injectable } from '@nestjs/common';
import type { ContactRole, ListQuery } from '@callback/shared';
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import type { DatabaseTransaction } from '../audit/audit-transaction.interface.js';
import { DATABASE } from '../db/database.const.js';
import type { Database } from '../db/database.interface.js';
import { contactRoles, contacts, customers } from '../db/schema.js';
import type {
  ContactRoleRow,
  ContactRow,
  NewContactRow,
} from '../db/schema.js';
import { customerNotDeletedFilter } from './customers.filter.js';
import type { ContactWithRoles } from './customers.interface.js';
import {
  isContactUserMismatch,
  isPrimaryContactConflict,
} from './customers-contacts.error-guard.js';
import {
  ContactRowMissingError,
  ContactUserMismatchError,
  PrimaryContactConflictError,
} from './customers-contacts.errors.js';
import {
  contactNotDeletedFilter,
  contactVisibleFilter,
} from './customers-contacts.filter.js';
import type {
  ContactPage,
  ContactPatch,
} from './customers-contacts.interface.js';
import {
  toContactsWithRoles,
  toRoleRows,
} from './customers-contacts.mapper.js';
import type { CustomerContactsRepository } from './customers-contacts.repository.interface.js';

/**
 * @param error - the caught driver error.
 * @param customerUserId - the user id the write attempted (`null` cannot violate
 *   the composite key, because a `NULL` component skips it under MATCH SIMPLE).
 * @returns the domain error when the FK rejected the write, else the original.
 */
function toContactUserMismatch(
  error: unknown,
  customerUserId: string | null | undefined,
): unknown {
  if (customerUserId === null || customerUserId === undefined) {
    return error;
  }

  return isContactUserMismatch(error)
    ? new ContactUserMismatchError(customerUserId, error)
    : error;
}

/**
 * Postgres-backed storage for `customer.contacts` and `customer.contact_roles`.
 *
 * @example
 * ```ts
 * const repository = new DrizzleCustomerContactsRepository(db);
 * const page = await repository.findPage(customerId, query);
 * ```
 */
@Injectable()
export class DrizzleCustomerContactsRepository implements CustomerContactsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** {@inheritDoc CustomerContactsRepository.customerExists} */
  async customerExists(customerId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, customerId), customerNotDeletedFilter()))
      .limit(1);

    return rows.length > 0;
  }

  /** {@inheritDoc CustomerContactsRepository.findPage} */
  async findPage(customerId: string, query: ListQuery): Promise<ContactPage> {
    // One expression for the count and the page query, so the two can never
    // disagree about the result set.
    const where = contactVisibleFilter(customerId, query);

    const [counted, rows] = await Promise.all([
      this.db.select({ total: count() }).from(contacts).where(where),
      this.db
        .select()
        .from(contacts)
        .where(where)
        .orderBy(
          query.order === 'asc' ? asc(contacts.name) : desc(contacts.name),
          asc(contacts.id),
        )
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
    ]);

    const roleRows = await this.findRolesOf(rows.map((row) => row.id));

    return {
      rows: toContactsWithRoles(rows, roleRows),
      total: Number(counted[0]?.total ?? 0),
    };
  }

  /** {@inheritDoc CustomerContactsRepository.findById} */
  async findById(
    customerId: string,
    contactId: string,
  ): Promise<ContactWithRoles | null> {
    const rows = await this.db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.customerId, customerId),
          eq(contacts.id, contactId),
          contactNotDeletedFilter(),
        ),
      )
      .limit(1);

    const [contact] = rows;

    if (contact === undefined) {
      return null;
    }

    const roleRows = await this.findRolesOf([contact.id]);

    return toContactsWithRoles([contact], roleRows)[0] ?? null;
  }

  /** {@inheritDoc CustomerContactsRepository.findAnyById} */
  async findAnyById(
    customerId: string,
    contactId: string,
  ): Promise<ContactRow | null> {
    // No `deleted_at` filter: this read exists to tell "absent" from "archived"
    // from "stale" for a write that matched nothing.
    const rows = await this.db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.customerId, customerId), eq(contacts.id, contactId)),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  /** {@inheritDoc CustomerContactsRepository.findRoles} */
  async findRoles(contactId: string): Promise<readonly ContactRoleRow[]> {
    return this.findRolesOf([contactId]);
  }

  /** {@inheritDoc CustomerContactsRepository.create} */
  async create(
    tx: DatabaseTransaction,
    input: NewContactRow,
  ): Promise<ContactRow> {
    let rows: ContactRow[];

    try {
      rows = await tx.insert(contacts).values(input).returning();
    } catch (error) {
      throw toContactUserMismatch(error, input.customerUserId);
    }

    const [row] = rows;

    if (row === undefined) {
      throw new ContactRowMissingError(null);
    }

    return row;
  }

  /** {@inheritDoc CustomerContactsRepository.updateById} */
  async updateById(
    tx: DatabaseTransaction,
    customerId: string,
    contactId: string,
    patch: ContactPatch,
    expectedUpdatedAt: Date,
  ): Promise<ContactRow | null> {
    try {
      const rows = await tx
        .update(contacts)
        .set(patch)
        .where(
          and(
            eq(contacts.id, contactId),
            eq(contacts.customerId, customerId),
            contactNotDeletedFilter(),
            eq(contacts.updatedAt, expectedUpdatedAt),
          ),
        )
        .returning();

      return rows[0] ?? null;
    } catch (error) {
      throw toContactUserMismatch(error, patch.customerUserId);
    }
  }

  /** {@inheritDoc CustomerContactsRepository.softDeleteById} */
  async softDeleteById(
    tx: DatabaseTransaction,
    customerId: string,
    contactId: string,
    deletedAt: Date,
  ): Promise<ContactRow | null> {
    const rows = await tx
      .update(contacts)
      .set({ deletedAt })
      .where(
        and(
          eq(contacts.id, contactId),
          eq(contacts.customerId, customerId),
          contactNotDeletedFilter(),
        ),
      )
      .returning();

    return rows[0] ?? null;
  }

  /** {@inheritDoc CustomerContactsRepository.replaceRoles} */
  async replaceRoles(
    tx: DatabaseTransaction,
    contactId: string,
    customerId: string,
    roles: readonly ContactRole[],
  ): Promise<void> {
    await tx.delete(contactRoles).where(eq(contactRoles.contactId, contactId));

    if (roles.length === 0) {
      return;
    }

    try {
      await tx
        .insert(contactRoles)
        .values([...toRoleRows(contactId, customerId, roles)]);
    } catch (error) {
      throw isPrimaryContactConflict(error)
        ? new PrimaryContactConflictError(contactId, error)
        : error;
    }
  }

  /** {@inheritDoc CustomerContactsRepository.deleteRoles} */
  async deleteRoles(tx: DatabaseTransaction, contactId: string): Promise<void> {
    await tx.delete(contactRoles).where(eq(contactRoles.contactId, contactId));
  }

  /** {@inheritDoc CustomerContactsRepository.runInTransaction} */
  async runInTransaction<T>(
    work: (tx: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) => work(tx));
  }

  /**
   * Reads the role rows of the given contacts in one round trip.
   *
   * @param contactIds - the contacts of one page (or a single contact).
   * @returns the role rows, or `[]` when the list is empty (an `IN ()` query is
   *   not worth sending).
   */
  private async findRolesOf(
    contactIds: readonly string[],
  ): Promise<readonly ContactRoleRow[]> {
    if (contactIds.length === 0) {
      return [];
    }

    return this.db
      .select()
      .from(contactRoles)
      .where(inArray(contactRoles.contactId, [...contactIds]));
  }
}
