import { jest } from '@jest/globals';
import type { Sql } from 'postgres';

/**
 * Fake `postgres.js` client + constructor spy.
 *
 * The real driver is lazy (it connects on the first query), so a test *could*
 * build one — but then the suite would depend on `DATABASE_URL` parsing and
 * would silently open a socket the moment a query runs. Everything here is
 * scripted instead, matching the "mock everything" rule in the coding
 * standards.
 */
export interface SqlClientMock {
  /** The value to inject as `DATABASE_CLIENT`. */
  readonly client: Sql;
  /** `client.end(...)` spy — the shutdown test asserts on it. */
  readonly end: jest.Mock<() => Promise<void>>;
  /** The callable part of a `postgres.js` client (tagged template / query fn). */
  readonly query: jest.Mock<() => Promise<unknown[]>>;
}

/**
 * @param endResult - `'resolve'` (default) makes `end()` succeed,
 *   `'reject'` makes it fail, so the shutdown error path can be exercised.
 */
export function createSqlClientMock(
  endResult: 'resolve' | 'reject' = 'resolve',
): SqlClientMock {
  const end = jest.fn<() => Promise<void>>(() =>
    endResult === 'reject'
      ? Promise.reject(new Error('connection already closed'))
      : Promise.resolve(),
  );
  const query = jest.fn<() => Promise<unknown[]>>(() => Promise.resolve([]));

  // drizzle-orm reads `options.parsers` / `options.serializers` when it builds
  // the schema-aware handle, hence the extra shape on the fake.
  const client = Object.assign(query, {
    end,
    options: { parsers: {}, serializers: {} },
  }) as unknown as Sql;

  return { client, end, query };
}
