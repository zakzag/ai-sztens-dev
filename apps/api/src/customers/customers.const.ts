/**
 * Server-side constants of the `customers` feature (AIS-178, slice b).
 *
 * Only what the **server** needs lives here: the DI token, the route segment,
 * the two constraint names and the sort map. Every limit, pattern and value set
 * is defined once in `@callback/shared` and enforced by the shared zod schemas
 * through `ZodBodyPipe` / `ZodQueryPipe`, so nothing is duplicated here.
 */

import type { CustomerSortField } from '@callback/shared';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { customers } from '../db/schema.js';

/**
 * DI token of the {@link CustomersRepository} implementation.
 *
 * A string token (not the class) is what makes the service depend on the
 * *interface*: the module binds the Drizzle implementation here, while the
 * service spec injects a plain mock object without Nest.
 */
export const CUSTOMERS_REPOSITORY = 'CUSTOMERS_REPOSITORY';

/**
 * Controller route segment.
 *
 * The global prefix (`api`, see `main.ts`) turns this into
 * `/api/admin/customers` — which is exactly {@link CUSTOMERS_PATH} in
 * `@callback/shared`, but the controller must not repeat the prefix: a Nest
 * controller path is relative to it (`api-keys` does the same).
 */
export const CUSTOMERS_ROUTE = 'admin/customers';

/**
 * Name of the unique constraint on `customer_number` (AIS-18).
 *
 * A **plain** unique constraint — unlike the tax number, a soft-deleted
 * customer keeps its number, because the number is the historical identifier of
 * the relationship.
 */
export const CUSTOMER_NUMBER_CONSTRAINT = 'customers_customer_number_key';

/**
 * Name of the **partial** unique index on `tax_number`
 * (`WHERE tax_number IS NOT NULL AND deleted_at IS NULL`).
 *
 * Partial on purpose: a missing tax number is a valid state (“incomplete
 * data”), and archiving a customer frees its tax number for a later record.
 * Classification therefore has to happen by constraint name — a pre-check
 * (`SELECT … WHERE tax_number = …`) would lie about the partial predicate.
 */
export const CUSTOMER_TAX_NUMBER_CONSTRAINT = 'customers_tax_number_key';

/**
 * How many times `create` may try to allocate a customer number.
 *
 * `max()` of the month inside the write transaction, retried **once** on a
 * `23505` (plan `D6`) — and each attempt needs a *fresh* transaction: a unique
 * violation aborts the Postgres transaction, so an in-place retry is
 * impossible. A `pg_advisory_xact_lock` per month would remove collisions
 * entirely and is documented as the alternative, not built.
 */
export const CREATE_ATTEMPTS = 2;

/** Highest sequence a month can hold in the `AIS-YYYYMM-NNN` format. */
export const CUSTOMER_NUMBER_SEQUENCE_MAX = 999;

/**
 * The sortable **stored** columns behind each `?sort=` value (AIS-178 `F12`).
 *
 * Typed against the contract's allow-list minus the one derived field, so a
 * column cannot be accepted by the schema without a column to sort by — adding
 * a field to `CUSTOMER_SORT_FIELDS` without extending this map is a compile
 * error, not a `500` from the database.
 *
 * `lastActivityAt` is deliberately **not** here: it is a projection alias that
 * only exists inside the page query (`max(activities.created_at)`), so it is
 * handled explicitly in the repository, where the alias is in scope.
 */
export const CUSTOMER_SORT_COLUMNS: Readonly<
  Record<Exclude<CustomerSortField, 'lastActivityAt'>, PgColumn>
> = {
  customerNumber: customers.customerNumber,
  legalName: customers.legalName,
  shortName: customers.shortName,
  status: customers.status,
  createdAt: customers.createdAt,
  updatedAt: customers.updatedAt,
};

/** The audited table name of the resource (see `AUDIT_TABLE_NAMES`). */
export const CUSTOMERS_TABLE_NAME = 'customers';
