import { sql } from 'drizzle-orm';
import { PgDialect, pgTable, uuid } from 'drizzle-orm/pg-core';

import { activities, contactRoles, contacts, customers } from './schema.js';
import { qualifiedColumn } from './sql-reference.js';

/**
 * Unit tests for {@link qualifiedColumn}.
 *
 * The helper exists because a `sql` template embedding a Drizzle `Column`
 * renders the bare column name once the template becomes a `select()` field,
 * which made the correlated subqueries of the customer list ambiguous
 * (`42702`). The assertions therefore render through the real `PgDialect`
 * rather than comparing against a hand-built string.
 */

const dialect = new PgDialect();

describe('qualifiedColumn', () => {
  it('renders the schema, the table and the column of a schema table', () => {
    const reference = qualifiedColumn(activities, activities.customerId);

    expect(dialect.sqlToQuery(reference).sql).toBe(
      '"activity"."activities"."customer_id"',
    );
  });

  it('names both tables that share the ambiguous column', () => {
    const fromContacts = qualifiedColumn(contacts, contacts.customerId);
    const fromRoles = qualifiedColumn(contactRoles, contactRoles.customerId);

    expect(dialect.sqlToQuery(fromContacts).sql).toBe(
      '"customer"."contacts"."customer_id"',
    );
    expect(dialect.sqlToQuery(fromRoles).sql).toBe(
      '"customer"."contact_roles"."customer_id"',
    );
  });

  it('omits the schema prefix for a table without a schema', () => {
    const widgets = pgTable('widgets', { id: uuid('id').primaryKey() });

    expect(dialect.sqlToQuery(qualifiedColumn(widgets, widgets.id)).sql).toBe(
      '"widgets"."id"',
    );
  });

  it('stays qualified when embedded in a larger expression', () => {
    const expression = sql`select ${qualifiedColumn(customers, customers.id)}`;

    expect(dialect.sqlToQuery(expression).sql).toBe(
      'select "customer"."customers"."id"',
    );
  });
});
