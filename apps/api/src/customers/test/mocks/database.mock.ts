import { jest } from '@jest/globals';
import type { DatabaseTransaction } from '../../../audit/audit-transaction.interface.js';
import type { Database } from '../../../db/database.interface.js';
import {
  customerTags,
  customers,
  customerUsers,
  contacts,
} from '../../../db/schema.js';
import type {
  CustomerRow,
  CustomerUserRow,
  TagRow,
} from '../../../db/schema.js';
import type {
  ContactRoleJoinRow,
  CustomerListRow,
} from '../../customers.interface.js';

/**
 * Chainable `Database` mock for the `customers` repository spec (AIS-178).
 *
 * The repository builds seven query shapes:
 *
 * ```text
 * insert(customers).values(input).returning()                      // create
 * update(customers).set(patch).where(expr).returning()             // guarded writes
 * select({ total: count() }).from(customers).where(expr)           // count(*)
 * select({ max: … }).from(customers).where(expr)                   // nextCustomerNumber
 * select(PROJECTION).from(customers).where(…).orderBy(…).limit/offset  // page / parent
 * select().from(customers).where(expr).limit(1)                    // findAnyById
 * select(…).from(<child>).innerJoin|leftJoin(…).where(…).orderBy() // detail children
 * ```
 *
 * Two decisions shape the mock:
 *
 * 1. **Routing is by table identity plus the shape of the `select()` field map**,
 *    not by call order: `findPage` builds two chains inside one `Promise.all`, so
 *    a queue would make the assertions depend on which promise resolves first.
 * 2. **Every chain gets its own spies**, and each argument is appended to a
 *    recorded list (`whereExpressions`, `orderByArguments`, …). Sharing one spy
 *    for `where` would mean the second `from()` overwrites the first chain's
 *    implementation — the classic “the mock proves nothing” trap.
 *
 * Everything is *lazy* (a thenable that only resolves when awaited), because an
 * eagerly created rejected promise that a test then abandons — by chaining
 * `.orderBy()` on top of it — is an unhandled rejection and kills the worker.
 *
 * The mock only promises **contract-level** assertions — “`insert` was called
 * with this payload”, “the count and the page share one `WHERE` object”, “the
 * offset is `(page - 1) * limit`” — never Drizzle's internal call order, which is
 * free to change between minor versions.
 */

/** Which of the four projections the repository asked for. */
type SelectMode = 'raw' | 'count' | 'max' | 'projected';

/** Scripted outcomes of one mock instance. */
export interface CustomersDatabaseMockOptions {
  /** Rows resolved by a projected customer select (page + detail parent). */
  readonly customerRows?: readonly CustomerListRow[];
  /** Rows resolved by `select()` without a field map (`findAnyById`). */
  readonly rawRows?: readonly CustomerRow[];
  /** `total` reported by the `count(*)` query; defaults to `0`. */
  readonly total?: number;
  /** Value reported by the `max(customer_number)` query; defaults to `null`. */
  readonly maxCustomerNumber?: string | null;
  /** Rows resolved by the tag select. */
  readonly tagRows?: readonly TagRow[];
  /** Rows resolved by the contacts ⋈ contact_roles select. */
  readonly contactRows?: readonly ContactRoleJoinRow[];
  /** Rows resolved by the customer-users select. */
  readonly customerUserRows?: readonly CustomerUserRow[];
  /** Rows resolved by `insert().values().returning()`. */
  readonly insertedRows?: readonly CustomerRow[];
  /** Rows resolved by `update().set().where().returning()`. */
  readonly updatedRows?: readonly CustomerRow[];
  /** Error rejected by `returning()` of the insert chain. */
  readonly insertError?: Error;
  /** Error rejected by `returning()` of the update chain. */
  readonly updateError?: Error;
  /** Error rejected by any select chain. */
  readonly selectError?: Error;
  /** Error rejected by the `count(*)` query. */
  readonly countError?: Error;
}

/** A promise that still exposes the next builder step (see the docblock). */
type Chainable<TRow, TNext> = Promise<TRow> & TNext;

/**
 * Builds a **lazy** thenable that also exposes the next builder step.
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

/** Handle exposing both the injected values and the recorded calls. */
export interface CustomersDatabaseMock {
  /** Value to inject as `DATABASE`. */
  readonly db: Database;
  /** Value to hand to a method that expects a transaction handle. */
  readonly tx: DatabaseTransaction;
  readonly insert: jest.Mock;
  readonly values: jest.Mock;
  readonly returning: jest.Mock;
  readonly select: jest.Mock;
  readonly from: jest.Mock;
  readonly update: jest.Mock;
  readonly set: jest.Mock;
  readonly updateReturning: jest.Mock;
  readonly transaction: jest.Mock;
  /** The `WHERE` expression of every select chain, in build order. */
  readonly whereExpressions: readonly unknown[];
  /** The argument list of every `orderBy()`, in build order. */
  readonly orderByArguments: readonly (readonly unknown[])[];
  /** The argument of every `limit()`, in build order. */
  readonly limitArguments: readonly unknown[];
  /** The argument of every `offset()`, in build order. */
  readonly offsetArguments: readonly unknown[];
  /** The `WHERE` expression of every update chain, in call order. */
  readonly updateWhereExpressions: readonly unknown[];
  /** The patch of every `update().set()`, in call order. */
  readonly updateSetArguments: readonly unknown[];
}

/**
 * Reads which select shape the repository asked for.
 *
 * @param fields - the argument of `select()`.
 * @returns the mode, decided by the field map only (never by call order).
 */
function readSelectMode(fields: unknown): SelectMode {
  if (fields === undefined) {
    return 'raw';
  }

  if (typeof fields === 'object' && fields !== null) {
    const keys = Object.keys(fields);

    if (keys.includes('total')) {
      return 'count';
    }

    if (keys.includes('max')) {
      return 'max';
    }
  }

  return 'projected';
}

/**
 * Builds a fresh mock (no state shared between tests).
 *
 * @param options - scripted rows/errors/total; defaults are “no rows, no error”.
 */
export function createCustomersDatabaseMock(
  options: CustomersDatabaseMockOptions = {},
): CustomersDatabaseMock {
  const whereExpressions: unknown[] = [];
  const orderByArguments: (readonly unknown[])[] = [];
  const limitArguments: unknown[] = [];
  const offsetArguments: unknown[] = [];
  const updateWhereExpressions: unknown[] = [];
  const updateSetArguments: unknown[] = [];

  const resolved = <T>(rows: readonly T[] | undefined): Promise<T[]> =>
    options.selectError !== undefined
      ? Promise.reject(options.selectError)
      : Promise.resolve([...(rows ?? [])]);

  const counted = (): Promise<{ readonly total: number }[]> =>
    options.countError !== undefined
      ? Promise.reject(options.countError)
      : Promise.resolve([{ total: options.total ?? 0 }]);

  const maxed = (): Promise<{ readonly max: string | null }[]> =>
    options.selectError !== undefined
      ? Promise.reject(options.selectError)
      : Promise.resolve([{ max: options.maxCustomerNumber ?? null }]);

  /** The rows one `select … from <table>` resolves, by table and mode. */
  const rowsFor = (table: object, mode: SelectMode): Promise<unknown[]> => {
    if (table === customers) {
      switch (mode) {
        case 'count':
          return counted();
        case 'max':
          return maxed();
        case 'raw':
          return resolved(options.rawRows);
        case 'projected':
          return resolved(options.customerRows);
      }
    }

    if (table === customerTags) {
      return resolved(options.tagRows);
    }

    if (table === contacts) {
      return resolved(options.contactRows);
    }

    if (table === customerUsers) {
      return resolved(options.customerUserRows);
    }

    return Promise.reject(
      new Error('createCustomersDatabaseMock: unmocked table in a select'),
    );
  };

  /** Reads the mode captured at `select()` time, for the pending `from()`. */
  let pendingMode: SelectMode = 'projected';

  const select = jest.fn((fields?: unknown) => {
    pendingMode = readSelectMode(fields);
    return { from };
  });

  const from = jest.fn((table: object) => {
    const mode = pendingMode;
    const resolveRows = (): Promise<unknown[]> => rowsFor(table, mode);

    const offset = jest.fn((value: unknown) => {
      offsetArguments.push(value);
      return resolveRows();
    });
    const limit = jest.fn((value: unknown) => {
      limitArguments.push(value);
      return chainable(resolveRows, { offset });
    });
    const orderBy = jest.fn((...args: unknown[]) => {
      orderByArguments.push(args);
      return chainable(resolveRows, { limit });
    });
    const where = jest.fn((expression: unknown) => {
      whereExpressions.push(expression);
      return chainable(resolveRows, { orderBy, limit });
    });
    const leftJoin = jest.fn(() => ({ where }));
    const innerJoin = jest.fn(() => ({ where, orderBy }));

    return { where, orderBy, limit, offset, leftJoin, innerJoin };
  });

  const returning = jest.fn(() =>
    options.insertError !== undefined
      ? Promise.reject(options.insertError)
      : Promise.resolve([...(options.insertedRows ?? [])]),
  );
  const values = jest.fn(() => ({ returning }));
  const insert = jest.fn(() => ({ values }));

  const updateReturning = jest.fn(() =>
    options.updateError !== undefined
      ? Promise.reject(options.updateError)
      : Promise.resolve([...(options.updatedRows ?? [])]),
  );
  const updateWhere = jest.fn((expression: unknown) => {
    updateWhereExpressions.push(expression);
    return { returning: updateReturning };
  });
  const set = jest.fn((patch: unknown) => {
    updateSetArguments.push(patch);
    return { where: updateWhere };
  });
  const update = jest.fn(() => ({ set }));

  const handle = { insert, select, update } as unknown as DatabaseTransaction;

  const transaction = jest.fn(
    async <T>(work: (tx: DatabaseTransaction) => Promise<T>): Promise<T> =>
      work(handle),
  );

  // The real handle is a large Drizzle object; only the entry points the
  // repository uses are modelled, hence the explicit double assertion.
  const db = { insert, select, update, transaction } as unknown as Database;

  return {
    db,
    tx: handle,
    insert,
    values,
    returning,
    select,
    from,
    update,
    set,
    updateReturning,
    transaction,
    whereExpressions,
    orderByArguments,
    limitArguments,
    offsetArguments,
    updateWhereExpressions,
    updateSetArguments,
  };
}
