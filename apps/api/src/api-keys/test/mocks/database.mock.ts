import { jest } from '@jest/globals';
import type { Database } from '../../../db/database.interface.js';
import type { ApiKeyRow } from '../../../db/schema.js';

/**
 * Chainable `Database` mock for the repository spec.
 *
 * The repository builds three query shapes:
 *
 * ```text
 * insert(table).values(input).returning()
 * select().from(table).orderBy(expr)
 * select().from(table).where(expr).limit(1)
 * ```
 *
 * Each of those is scripted here instead of being reached through a real
 * driver: the coding standard demands mocked dependencies, and a real
 * connection would need `DATABASE_URL` plus a migrated table just to unit-test
 * a `try/catch`.
 *
 * The mock only promises *contract-level* assertions — “`insert` was called”,
 * “`returning` was awaited”, “`select` was **not** called” — never Drizzle's
 * internal call order, which is free to change between minor versions.
 */

/**
 * Postgres-style error the repository has to classify (`23505`).
 *
 * The field name mirrors `postgres.js`, which reports the violated constraint as
 * `constraint_name` — the first live smoke test showed the difference matters
 * (the classifier must not depend on the other spelling).
 */
export class PostgresErrorMock extends Error {
  /** SQLSTATE, e.g. `23505`. */
  public readonly code: string;

  /** Violated constraint name, as `postgres.js` reports it. */
  public readonly constraint_name?: string;

  constructor(code: string, constraint?: string) {
    super(`scripted postgres error ${code}`);
    this.name = 'PostgresErrorMock';
    this.code = code;
    this.constraint_name = constraint;
  }
}

/**
 * Wraps a driver error the way Drizzle does (`DrizzleQueryError`).
 *
 * @param cause - the underlying `postgres.js` error.
 * @returns an error whose only relevant property is `cause`.
 */
export function wrapDrizzleQueryError(cause: unknown): Error {
  return new Error('Failed query: insert into "platform"."api_keys" …', {
    cause,
  });
}

/** Scripted outcomes of one mock instance. */
export interface DatabaseMockOptions {
  /** Rows resolved by `insert().values().returning()`. */
  readonly insertedRows?: readonly ApiKeyRow[];
  /** Error rejected by `returning()` instead of rows. */
  readonly insertError?: Error;
  /** Rows resolved by `select()…orderBy()` and `select()…where().limit()`. */
  readonly selectedRows?: readonly ApiKeyRow[];
  /** Error rejected by the select chain instead of rows. */
  readonly selectError?: Error;
}

/** Handle exposing both the injected value and the spies. */
export interface DatabaseMock {
  /** Value to inject as `DATABASE`. */
  readonly db: Database;
  readonly insert: jest.Mock;
  readonly values: jest.Mock;
  readonly returning: jest.Mock;
  readonly select: jest.Mock;
  readonly from: jest.Mock;
  readonly orderBy: jest.Mock;
  readonly where: jest.Mock;
  readonly limit: jest.Mock;
}

/**
 * Builds a fresh mock (no state shared between tests).
 *
 * @param options - scripted rows/errors; defaults are “no rows, no error”.
 */
export function createDatabaseMock(
  options: DatabaseMockOptions = {},
): DatabaseMock {
  const returning = jest.fn(() =>
    options.insertError !== undefined
      ? Promise.reject(options.insertError)
      : Promise.resolve([...(options.insertedRows ?? [])]),
  );
  const values = jest.fn(() => ({ returning }));
  const insert = jest.fn(() => ({ values }));

  const resolveSelect = () =>
    options.selectError !== undefined
      ? Promise.reject(options.selectError)
      : Promise.resolve([...(options.selectedRows ?? [])]);

  const limit = jest.fn(resolveSelect);
  const orderBy = jest.fn(resolveSelect);
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ orderBy, where }));
  const select = jest.fn(() => ({ from }));

  // The real handle is a large Drizzle object; only the two entry points the
  // repository uses are modelled, hence the explicit double assertion.
  const db = { insert, select } as unknown as Database;

  return { db, insert, values, returning, select, from, orderBy, where, limit };
}
