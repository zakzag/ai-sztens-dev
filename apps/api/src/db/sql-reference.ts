import { getTableName, sql, type SQL } from 'drizzle-orm';
import {
  getTableConfig,
  type PgColumn,
  type PgTable,
} from 'drizzle-orm/pg-core';

/**
 * Renders a schema-qualified column reference (`"schema"."table"."column"`).
 *
 * A `sql` template that embeds a Drizzle `Column` renders the **bare** column
 * name once the template is a field of a `select()` (Drizzle assumes the
 * column's own table is the one in scope). That assumption breaks in a
 * correlated subquery: `customer.contacts` and `customer.contact_roles` both
 * carry `customer_id`, so the bare form made Postgres answer
 * `42702 column reference "customer_id" is ambiguous` and every customer list
 * request answered `500` (AIS-14 R1).
 *
 * `sql.raw` is untouched by the query builder, so the reference stays
 * qualified regardless of where the expression is embedded. The identifiers
 * are read from the Drizzle metadata, never typed by hand, so a rename in
 * `schema.ts` still propagates.
 *
 * @param table - the Drizzle table the column belongs to.
 * @param column - the column to reference.
 * @returns the fully qualified reference as a raw SQL fragment.
 *
 * @example qualifiedColumn(activities, activities.customerId) // "activity"."activities"."customer_id"
 */
export function qualifiedColumn(table: PgTable, column: PgColumn): SQL {
  const { schema } = getTableConfig(table);
  const tableName = getTableName(table);
  const prefix =
    schema === undefined ? `"${tableName}"` : `"${schema}"."${tableName}"`;

  return sql.raw(`${prefix}."${column.name}"`);
}
