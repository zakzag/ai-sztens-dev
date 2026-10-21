import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

/**
 * The Drizzle handle the API injects wherever SQL has to run.
 *
 * Typing it with `typeof schema` means every repository gets the schema-aware
 * `db.select().from(apiKeys)` overloads, so a column typo is a compile error
 * instead of a runtime one — the whole reason the schema is code.
 *
 * Consumers depend on this alias (an abstraction), never on a concrete
 * `drizzle(...)` call, which is what makes the repositories unit-testable with a
 * plain mock object (AIS-37) and lets the Nest provider be the only place that
 * knows about `postgres.js` (AIS-38).
 */
export type Database = PostgresJsDatabase<typeof schema>;
