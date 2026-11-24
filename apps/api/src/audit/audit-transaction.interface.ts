/**
 * The transaction handle an audited write must share with its business write
 * (AIS-177).
 *
 * Derived from {@link Database} instead of being spelled out: Drizzle's
 * transaction type carries four generic parameters (query result, schema,
 * client, config), and hand-writing them means every Drizzle upgrade is a
 * chance to get one wrong. `Parameters<…>` asks the same question the compiler
 * already knows the answer to.
 *
 * Why it matters: the writer's signature **requires** this handle. Passing the
 * root `Database` does not type-check, so a service cannot silently write its
 * audit row outside the transaction that wrote the row it describes.
 */

import type { Database } from '../db/database.interface.js';

/** The `tx` argument Drizzle hands to a `db.transaction(...)` callback. */
export type DatabaseTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];
