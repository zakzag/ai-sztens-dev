/**
 * NestJS injection tokens for the database layer.
 *
 * String tokens are used instead of classes because both values are types /
 * third-party objects, not project classes:
 *
 * - {@link DATABASE} → the schema-aware Drizzle handle (`Database`).
 * - {@link DATABASE_CLIENT} → the raw `postgres.js` client (`Sql`).
 *
 * **Who may inject what** (keeps the abstraction boundary honest):
 *
 * - repositories and services inject **`DATABASE`** only;
 * - `DATABASE_CLIENT` is reserved for the connection-lifecycle hook
 *   (`database-lifecycle.service.ts`), which needs `client.end()` — something
 *   the Drizzle handle does not expose.
 *
 * Keeping the tokens in their own constants file (coding standards → *constants
 * go in `.const.ts`*) means the provider and every consumer import the same
 * symbols, so a typo cannot silently create a second, unresolved token.
 */
export const DATABASE = 'DRIZZLE_DATABASE';

/** Raw `postgres.js` client, used only to close the pool on shutdown. */
export const DATABASE_CLIENT = 'POSTGRES_CLIENT';

/** Env variable that overrides the pool size. */
export const DATABASE_POOL_MAX_ENV = 'DATABASE_POOL_MAX';

/**
 * Pool size used when {@link DATABASE_POOL_MAX_ENV} is absent or invalid.
 *
 * The API is the only writer on a 2 GB droplet where Postgres itself runs with
 * conservative memory settings, so 10 connections is both comfortable and far
 * below the server's `max_connections`.
 */
export const DEFAULT_DATABASE_POOL_MAX = 10;
