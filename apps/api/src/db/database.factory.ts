/**
 * Pure factories for the database layer.
 *
 * Kept free of `@nestjs/config` on purpose: the modules that *define* the
 * providers need `ConfigService` at runtime, but the tests must not — the
 * Jest ESM runner can only load the CommonJS-only `@nestjs/config` on
 * Node >= 24.9 (see `test/lib/app-module-gate.ts`). Depending on a tiny
 * structural interface instead keeps this file unit-testable on every Node
 * version the project supports.
 *
 * Both factories take the third-party constructor as an **injectable default
 * parameter**. Production always uses the defaults (`postgres`, `drizzle`); the
 * tests pass a spy, so every branch — including the configuration error — is
 * exercised without a socket, a container or a `DATABASE_URL`.
 *
 * Nothing here opens a connection: `postgres.js` connects lazily on the first
 * query, which is why a boot-time configuration check is enough (plan D5).
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import {
  DATABASE_POOL_MAX_ENV,
  DEFAULT_DATABASE_POOL_MAX,
} from './database.const.js';
import { DatabaseConfigurationError } from './database.errors.js';
import type { Database } from './database.interface.js';
import * as schema from './schema.js';

/** The only part of `ConfigService` this layer depends on. */
export interface DatabaseEnvSource {
  get(key: string): unknown;
}

/** Options handed to `postgres.js`; narrowed to what this module controls. */
export interface DatabaseClientOptions {
  readonly max: number;
  readonly onnotice: () => void;
}

/** Constructor seam for `postgres.js`. */
export type PostgresClientFactory = (
  url: string,
  options: DatabaseClientOptions,
) => Sql;

/** Constructor seam for Drizzle's postgres.js driver. */
export type DrizzleFactory = (
  client: Sql,
  config: { schema: typeof schema },
) => Database;

/**
 * Resolves the pool size from the raw env value.
 *
 * Defensive on purpose: a typo in `DATABASE_POOL_MAX` must not take the API
 * down, it must fall back to the documented default. Only positive integers are
 * accepted — `0`, negative values and non-numeric strings all fall back.
 *
 * @param raw - the raw `DATABASE_POOL_MAX` value (may be `undefined`).
 * @returns the pool size to use, always a positive integer.
 */
export function resolvePoolMax(raw: string | undefined): number {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length === 0) return DEFAULT_DATABASE_POOL_MAX;

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_DATABASE_POOL_MAX;

  return parsed;
}

/**
 * Reads and validates `DATABASE_URL` from the configuration source.
 *
 * @throws {DatabaseConfigurationError} when the value is missing or blank — a
 * silent fallback would let the API run without persistence, which is exactly
 * the state AIS-64 was cleaning up.
 */
export function readDatabaseUrl(config: DatabaseEnvSource): string {
  const raw = config.get('DATABASE_URL');
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (url.length === 0) {
    throw new DatabaseConfigurationError('DATABASE_URL', 'is not set or blank');
  }
  return url;
}

/** Reads `DATABASE_POOL_MAX` without trusting its type. */
function readPoolMax(config: DatabaseEnvSource): number {
  const raw = config.get(DATABASE_POOL_MAX_ENV);
  return resolvePoolMax(typeof raw === 'string' ? raw : undefined);
}

/**
 * Builds the `postgres.js` client.
 *
 * `onnotice` is silenced for the same reason as in the migration runner: the
 * only notices this stack produces are "already exists, skipping" ones, and
 * letting them through makes a healthy boot look broken.
 */
export function createDatabaseClient(
  config: DatabaseEnvSource,
  createClient: PostgresClientFactory = postgres,
): Sql {
  const url = readDatabaseUrl(config);
  const max = readPoolMax(config);

  return createClient(url, { max, onnotice: () => undefined });
}

/**
 * Wraps the client into the schema-aware Drizzle handle.
 *
 * `{ schema }` is passed explicitly so the handle keeps the exact
 * `PostgresJsDatabase<typeof schema>` type (`Database`), which is what gives
 * repositories typed `db.select().from(table)` overloads.
 */
export function createDatabase(
  client: Sql,
  createDrizzle: DrizzleFactory = drizzle,
): Database {
  return createDrizzle(client, { schema });
}
