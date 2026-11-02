import { jest } from '@jest/globals';
import type { Database } from '../../../db/database.interface.js';
import type { ApiKeyRow } from '../../../db/schema.js';

/**
 * Chainable `Database` mock for the repository spec.
 *
 * The repository builds four query shapes:
 *
 * ```text
 * insert(table).values(input).returning()
 * select({ total: count() }).from(table).where(expr)          // count(*) — AIS-107
 * select().from(table).where(expr).limit(n).offset(m)         // one page
 * select().from(table).where(expr).limit(1)                   // single row
 * ```
 *
 * The last two end at a **different** terminal (`offset` vs `limit`), and the
 * count query has no terminal at all, so the intermediate nodes are *hybrids*:
 * awaiting them yields the rows **and** they still expose the next builder.
 * That is exactly what the (thenable) Drizzle query builder does, which is why
 * `await db.select()…where(expr)` is legal in the repository.
 *
 * Each of those steps is scripted here instead of being reached through a real
 * driver: the coding standard demands mocked dependencies, and a real
 * connection would need `DATABASE_URL` plus a migrated table just to unit-test
 * a `try/catch`.
 *
 * The mock only promises *contract-level* assertions — “`insert` was called”,
 * “`returning` was awaited”, “the offset is `(page - 1) * limit`” — never
 * Drizzle's internal call order, which is free to change between minor
 * versions.
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
  /** Rows resolved by the row-selecting chains. */
  readonly selectedRows?: readonly ApiKeyRow[];
  /** Error rejected by the row-selecting chains instead of rows. */
  readonly selectError?: Error;
  /** `total` reported by the `count(*)` query; defaults to `0`. */
  readonly total?: number;
  /** Error rejected by the `count(*)` query instead of a number. */
  readonly countError?: Error;
}

/** A promise that still exposes the next builder step (see the docblock). */
type Chainable<TRow, TNext> = Promise<TRow> & TNext;

/**
 * Builds a **lazy** thenable that also exposes the next builder step.
 *
 * Lazy matters: `Promise.resolve(rejected)` created eagerly and then abandoned
 * (because the test chains `.orderBy()` on top of it) is an *unhandled
 * rejection*, which kills the Jest worker instead of failing one test. Here the
 * row promise is only created when something actually awaits the node.
 *
 * @param resolveValue - produces the rows (or the scripted error) on demand.
 * @param next - the builder methods this node exposes.
 * @returns a thenable carrying `next`.
 */
function chainable<TRow, TNext extends object>(
  resolveValue: () => Promise<TRow>,
  next: TNext,
): Chainable<TRow, TNext> {
  const thenable = {
    then: (
      onFulfilled?: ((value: TRow) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => resolveValue().then(onFulfilled, onRejected),
    catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
      resolveValue().catch(onRejected),
    finally: (onFinally?: (() => void) | null) =>
      resolveValue().finally(onFinally),
    [Symbol.toStringTag]: 'Promise',
  };

  return Object.assign(thenable, next) as Chainable<TRow, TNext>;
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
  readonly offset: jest.Mock;
  /** `where()` of the `count(*)` chain (a terminal: it resolves the count). */
  readonly countWhere: jest.Mock;
}

/**
 * Builds a fresh mock (no state shared between tests).
 *
 * @param options - scripted rows/errors/total; defaults are “no rows, no error”.
 */
export function createDatabaseMock(
  options: DatabaseMockOptions = {},
): DatabaseMock {
  const rows = (): Promise<ApiKeyRow[]> =>
    options.selectError !== undefined
      ? Promise.reject(options.selectError)
      : Promise.resolve([...(options.selectedRows ?? [])]);

  const counted = (): Promise<{ readonly total: number }[]> =>
    options.countError !== undefined
      ? Promise.reject(options.countError)
      : Promise.resolve([{ total: options.total ?? 0 }]);

  const returning = jest.fn(() =>
    options.insertError !== undefined
      ? Promise.reject(options.insertError)
      : Promise.resolve([...(options.insertedRows ?? [])]),
  );
  const values = jest.fn(() => ({ returning }));
  const insert = jest.fn(() => ({ values }));

  // `offset` is terminal for a page query, `limit` is terminal for a
  // single-row lookup — so the intermediate nodes resolve the rows *and* carry
  // the next builder step, exactly like drizzle's thenable builder.
  const offset = jest.fn(rows);
  const limit = jest.fn(() => chainable(rows, { offset }));
  const orderBy = jest.fn(() => ({ limit }));
  const where = jest.fn(() => chainable(rows, { orderBy, limit }));
  // The count chain stops at `where`, exactly like drizzle's builder does.
  const countWhere = jest.fn(counted);

  // `select()` with a field map is the count query, `select()` without one is a
  // row query. The flag is safe because each chain is built synchronously.
  let selectingCount = false;
  const select = jest.fn((fields?: unknown) => {
    selectingCount = fields !== undefined;
    return { from };
  });
  const from = jest.fn(() =>
    selectingCount ? { where: countWhere } : { where, orderBy },
  );

  // The real handle is a large Drizzle object; only the two entry points the
  // repository uses are modelled, hence the explicit double assertion.
  const db = { insert, select } as unknown as Database;

  return {
    db,
    insert,
    values,
    returning,
    select,
    from,
    orderBy,
    where,
    limit,
    offset,
    countWhere,
  };
}
