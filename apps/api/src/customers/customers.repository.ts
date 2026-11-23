/**
 * Drizzle implementation of {@link CustomersRepository} (AIS-178).
 *
 * This is the only file in the feature that builds SQL, and the only one that
 * may import Drizzle. It receives the shared `DATABASE` handle from
 * `DatabaseModule` (never creates a client) and translates exactly two failure
 * modes into domain errors: the two named unique constraints. Everything else is
 * re-thrown untouched, so a connection or permission problem is never disguised
 * as a business conflict.
 *
 * Two design notes a future editor should not "simplify" away:
 *
 * 1. **The derived projections are scalar subqueries, not LATERAL joins.** The
 *    plan spells them as LATERAL; a correlated scalar subquery with `LIMIT 1`
 *    produces the same plan class for these shapes (both are per-row SubPlans on
 *    an indexed predicate), while keeping the query a single `select … from
 *    customers`, which is what the repository spec can assert on. Either way
 *    there is **one** round trip and **no** fan-out: a customer with three
 *    activities and two tags still yields exactly one row.
 * 2. **Every read carries the soft-delete filter** — `findById`, the page, the
 *    count, the guarded writes. The single deliberate exception is
 *    `findAnyById`, which exists to *classify* a write that matched nothing.
 */

import { Inject, Injectable } from '@nestjs/common';
import type {
  CustomerListQuery,
  CustomerSortField,
  ListQueryOrder,
} from '@callback/shared';
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  isNull,
  like,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { DatabaseTransaction } from '../audit/audit-transaction.interface.js';
import { DATABASE } from '../db/database.const.js';
import type { Database } from '../db/database.interface.js';
import {
  activities,
  contactRoles,
  contacts,
  customerTags,
  customers,
  customerUsers,
  tags,
} from '../db/schema.js';
import type { CustomerRow, NewCustomerRow } from '../db/schema.js';
import { CUSTOMER_SORT_COLUMNS } from './customers.const.js';
import {
  isCustomerNumberConflict,
  isCustomerTaxNumberConflict,
} from './customers.error-guard.js';
import {
  CustomerNumberConflictError,
  CustomerRowMissingError,
  CustomerTaxNumberConflictError,
} from './customers.errors.js';
import {
  customerNotDeletedFilter,
  customerVisibleFilter,
} from './customers.filter.js';
import type {
  CustomerDetailRows,
  CustomerPatch,
  CustomerStatusPatch,
} from './customers.interface.js';
import { toContactsWithRoles } from './customers.mapper.js';
import type {
  CustomerPage,
  CustomersRepository,
} from './customers.repository.interface.js';

/**
 * `max(activities.created_at)` of the live activities of the outer customer.
 *
 * A customer without activities yields `null`, which is the contract's “nothing
 * recorded yet” — and it is also what `NULLS LAST` sorts on.
 */
const LAST_ACTIVITY_AT = sql<Date | null>`(
  select max(${activities.createdAt})
  from ${activities}
  where ${activities.customerId} = ${customers.id}
    and ${activities.deletedAt} is null
)`;

/**
 * Name of the contact holding the `primary` role, or `null`.
 *
 * `contact_roles_primary_key` is a partial **unique** index on
 * (`customer_id`) `WHERE role = 'primary'`, so `LIMIT 1` cannot hide a second
 * row: there is at most one by construction.
 */
const PRIMARY_CONTACT_NAME = sql<string | null>`(
  select ${contacts.name}
  from ${contacts}
  inner join ${contactRoles} on ${contactRoles.contactId} = ${contacts.id}
  where ${contacts.customerId} = ${customers.id}
    and ${contacts.deletedAt} is null
    and ${contactRoles.role} = 'primary'
  limit 1
)`;

/**
 * The column set every customer read returns: the row plus both projections.
 *
 * Typed by Drizzle from the subqueries, so a driver that returns a string
 * timestamp is a compile-time surprise rather than a silent `undefined`.
 */
const CUSTOMER_PROJECTION = {
  ...getTableColumns(customers),
  lastActivityAt: LAST_ACTIVITY_AT,
  primaryContactName: PRIMARY_CONTACT_NAME,
};

/**
 * @param error - the caught driver error.
 * @param customerNumber - the number the insert attempted.
 * @returns the domain error when `customer_number` collided, else the original.
 */
function toNumberConflict(error: unknown, customerNumber: string): unknown {
  return isCustomerNumberConflict(error)
    ? new CustomerNumberConflictError(customerNumber, error)
    : error;
}

/**
 * @param error - the caught driver error.
 * @param taxNumber - the tax number the write attempted (`null` clears it and
 *   can never collide, because the partial index excludes `NULL`).
 * @returns the domain error when a live row owns the tax number, else the
 *   original.
 */
function toTaxNumberConflict(
  error: unknown,
  taxNumber: string | null | undefined,
): unknown {
  if (taxNumber === null || taxNumber === undefined) {
    return error;
  }

  return isCustomerTaxNumberConflict(error)
    ? new CustomerTaxNumberConflictError(taxNumber, error)
    : error;
}

/**
 * Postgres-backed storage for `customer.customers`.
 *
 * @example
 * ```ts
 * const repository = new DrizzleCustomersRepository(db);
 * const page = await repository.findPage(query);
 * ```
 */
@Injectable()
export class DrizzleCustomersRepository implements CustomersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** {@inheritDoc CustomersRepository.findPage} */
  async findPage(query: CustomerListQuery): Promise<CustomerPage> {
    // One expression for the count and the page query, so the two can never
    // disagree about the result set (the total would then lie about the rows).
    const where = customerVisibleFilter(query);

    // Two round trips, deliberately: `count(*)` cannot be derived from the page
    // itself (`rows.length` is the page size, not the result size), and the
    // client's pager needs `total` before it can render page numbers.
    const [counted, rows] = await Promise.all([
      this.db.select({ total: count() }).from(customers).where(where),
      this.db
        .select(CUSTOMER_PROJECTION)
        .from(customers)
        .where(where)
        .orderBy(this.toOrderBy(query.sort, query.order), asc(customers.id))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
    ]);

    // The driver may report `count(*)` as a string on bigint columns, so the
    // value is normalised here instead of leaking an `unknown` type upwards.
    return { rows, total: Number(counted[0]?.total ?? 0) };
  }

  /** {@inheritDoc CustomersRepository.findById} */
  async findById(id: string): Promise<CustomerDetailRows | null> {
    const parents = await this.db
      .select(CUSTOMER_PROJECTION)
      .from(customers)
      .where(and(eq(customers.id, id), customerNotDeletedFilter()))
      .limit(1);

    const customer = parents[0];

    if (customer === undefined) {
      return null;
    }

    // Three child reads in parallel: the parent is known to exist, and none of
    // the three depends on another. Together with the parent lookup that is the
    // “at most four round trips” the plan promises.
    const [tagRows, contactRows, userRows] = await Promise.all([
      this.db
        .select({ id: tags.id, name: tags.name, isActive: tags.isActive })
        .from(customerTags)
        .innerJoin(tags, eq(customerTags.tagId, tags.id))
        .where(eq(customerTags.customerId, id))
        .orderBy(asc(tags.name)),
      // One left join instead of two reads: a contact without a role still comes
      // back (with `role: null`), so “no role yet” is an empty array and not a
      // missing contact.
      this.db
        .select({ contact: contacts, role: contactRoles.role })
        .from(contacts)
        .leftJoin(contactRoles, eq(contactRoles.contactId, contacts.id))
        .where(and(eq(contacts.customerId, id), isNull(contacts.deletedAt)))
        .orderBy(asc(contacts.name)),
      this.db
        .select()
        .from(customerUsers)
        .where(eq(customerUsers.customerId, id))
        .orderBy(asc(customerUsers.name)),
    ]);

    return {
      customer,
      tags: tagRows,
      contacts: toContactsWithRoles(contactRows),
      customerUsers: userRows,
    };
  }

  /** {@inheritDoc CustomersRepository.findAnyById} */
  async findAnyById(id: string): Promise<CustomerRow | null> {
    // No `deleted_at` filter and no projections: this read exists only to tell
    // “absent” from “deleted” from “stale” for a write that matched nothing.
    const rows = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  /** {@inheritDoc CustomersRepository.create} */
  async create(
    tx: DatabaseTransaction,
    input: NewCustomerRow,
  ): Promise<CustomerRow> {
    let rows: CustomerRow[];

    try {
      rows = await tx.insert(customers).values(input).returning();
    } catch (error) {
      throw toTaxNumberConflict(
        toNumberConflict(error, input.customerNumber),
        input.taxNumber,
      );
    }

    const [row] = rows;

    if (row === undefined) {
      throw new CustomerRowMissingError(null);
    }

    return row;
  }

  /** {@inheritDoc CustomersRepository.updateById} */
  async updateById(
    tx: DatabaseTransaction,
    id: string,
    patch: CustomerPatch,
    expectedUpdatedAt: Date,
  ): Promise<CustomerRow | null> {
    // One statement, three conditions — that is the whole point of the design.
    // A read-compare-write would leave a window in which another writer could
    // commit between the check and the update.
    try {
      const rows = await tx
        .update(customers)
        .set(patch)
        .where(
          and(
            eq(customers.id, id),
            customerNotDeletedFilter(),
            eq(customers.updatedAt, expectedUpdatedAt),
          ),
        )
        .returning();

      return rows[0] ?? null;
    } catch (error) {
      throw toTaxNumberConflict(error, patch.taxNumber);
    }
  }

  /** {@inheritDoc CustomersRepository.updateStatusById} */
  async updateStatusById(
    tx: DatabaseTransaction,
    id: string,
    patch: CustomerStatusPatch,
    expectedUpdatedAt: Date,
  ): Promise<CustomerRow | null> {
    // No error translation: a status change touches no unique constraint, so any
    // failure here is a real database problem and must stay a `500`.
    const rows = await tx
      .update(customers)
      .set(patch)
      .where(
        and(
          eq(customers.id, id),
          customerNotDeletedFilter(),
          eq(customers.updatedAt, expectedUpdatedAt),
        ),
      )
      .returning();

    return rows[0] ?? null;
  }

  /** {@inheritDoc CustomersRepository.softDeleteById} */
  async softDeleteById(
    tx: DatabaseTransaction,
    id: string,
    deletedAt: Date,
  ): Promise<CustomerRow | null> {
    // Archiving frees the tax number, because `customers_tax_number_key` is
    // partial on `deleted_at IS NULL`. It does **not** free the customer number:
    // that constraint is plain and the number stays the historical identifier.
    const rows = await tx
      .update(customers)
      .set({ deletedAt })
      .where(and(eq(customers.id, id), customerNotDeletedFilter()))
      .returning();

    return rows[0] ?? null;
  }

  /** {@inheritDoc CustomersRepository.nextCustomerNumber} */
  async nextCustomerNumber(
    tx: DatabaseTransaction,
    prefix: string,
  ): Promise<string | null> {
    const rows = await tx
      .select({ max: sql<string | null>`max(${customers.customerNumber})` })
      .from(customers)
      .where(like(customers.customerNumber, `${prefix}%`));

    return rows[0]?.max ?? null;
  }

  /** {@inheritDoc CustomersRepository.runInTransaction} */
  async runInTransaction<T>(
    work: (tx: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) => work(tx));
  }

  /**
   * Builds the `ORDER BY` expression of one sortable column.
   *
   * Two branches, one reason each:
   *
   * - a stored column uses Drizzle's `asc`/`desc` on the column object;
   * - `lastActivityAt` is a projection alias, so it has to sort on the same
   *   subquery — and with **`NULLS LAST` on both directions**, so a customer
   *   without activities forms one stable block at the end instead of floating
   *   to the top of an ascending page (Postgres' default for `DESC` is
   *   `NULLS FIRST`).
   *
   * @param sort - the validated sort column.
   * @param order - the validated direction.
   * @returns the SQL fragment for `orderBy`.
   */
  private toOrderBy(sort: CustomerSortField, order: ListQueryOrder): SQL {
    if (sort === 'lastActivityAt') {
      return order === 'asc'
        ? sql`${LAST_ACTIVITY_AT} asc nulls last`
        : sql`${LAST_ACTIVITY_AT} desc nulls last`;
    }

    const column = CUSTOMER_SORT_COLUMNS[sort];

    return order === 'asc' ? asc(column) : desc(column);
  }
}
