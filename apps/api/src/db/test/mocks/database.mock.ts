import { jest } from '@jest/globals';
import type { Database } from '../../database.interface.js';
import type {
  CallbackRequestRow,
  NewCallbackRequestRow,
} from '../../schema.js';

/**
 * A scripted stand-in for the Drizzle handle (AIS-37).
 *
 * ### Why a hand-rolled chain, instead of `jest.mock('drizzle-orm')`
 * The repository only ever calls three chains:
 *
 * ```text
 * db.insert(table).values(input).returning()          → create
 * db.select().from(table).orderBy(column)             → findAll
 * db.select().from(table).where(condition).limit(1)   → findOne
 * ```
 *
 * Modelling exactly those links keeps every branch reachable from a test while
 * the assertions stay on named handles (`insert`, `insertValues`, …) instead of
 * on an anonymous mock call order. No database, no network, no `DATABASE_URL`.
 *
 * ### `@jest/globals` instead of the global `jest`
 * The API's Jest setup runs in ESM mode (`--experimental-vm-modules`), where only
 * `describe`/`it`/`expect` are injected as globals — the `jest` object must be
 * imported, otherwise the suite dies with `ReferenceError: jest is not defined`.
 *
 * ### The one cast, in one place
 * `Database` is the full Drizzle type; a mock can never structurally satisfy it.
 * The single `as unknown as Database` lives here (documented), so the spec files
 * stay free of casts and cannot accidentally rely on a partially mocked handle.
 */

/** `INSERT … RETURNING` result. */
type ReturningMock = jest.Mock<() => Promise<CallbackRequestRow[]>>;
/** `SELECT … ORDER BY` result. */
type OrderByMock = jest.Mock<
  (column: unknown) => Promise<CallbackRequestRow[]>
>;
/** `SELECT … WHERE … LIMIT n` result. */
type LimitMock = jest.Mock<(count: number) => Promise<CallbackRequestRow[]>>;
/** `.where(condition)` step of the select chain. */
type WhereMock = jest.Mock<(condition: unknown) => { limit: LimitMock }>;
/** `.from(table)` step of the select chain — both shapes used today. */
type FromMock = jest.Mock<() => { where: WhereMock; orderBy: OrderByMock }>;
/** `.values(input)` step of the insert chain. */
type ValuesMock = jest.Mock<
  (values: NewCallbackRequestRow) => { returning: ReturningMock }
>;

/** Everything a test may script or assert on. */
export interface CallbackRequestsQueryMock {
  /** The handle to hand to `new DrizzleCallbackRequestsRepository(...)`. */
  readonly db: Database;
  /** `db.insert` spy. */
  readonly insert: jest.Mock<(table: unknown) => { values: ValuesMock }>;
  /** `.values(input)` spy. */
  readonly insertValues: ValuesMock;
  /** `.returning()` spy. */
  readonly insertReturning: ReturningMock;
  /** `db.select` spy — assert it was NOT called for an invalid id. */
  readonly select: jest.Mock<() => { from: FromMock }>;
  /** `.from(table)` spy. */
  readonly selectFrom: FromMock;
  /** `.where(condition)` spy, used by `findOne`. */
  readonly selectWhere: WhereMock;
  /** `.limit(n)` spy, used by `findOne`. */
  readonly selectLimit: LimitMock;
  /** `.orderBy(column)` spy, used by `findAll`. */
  readonly selectOrderBy: OrderByMock;

  /** `create()` → resolves with these rows (`[]` exercises the empty case). */
  mockCreateResult(rows: CallbackRequestRow[]): void;
  /**
   * `create()` → `db.insert()` itself throws (transport-level failure, before
   * any builder exists — the shape a dead socket actually produces).
   */
  mockInsertFailure(error: Error): void;
  /** `create()` → rejects at `.returning()` (query-level failure). */
  mockCreateFailure(error: Error): void;
  /** `findAll()` / `findOne()` → resolves with these rows. */
  mockSelectResult(rows: CallbackRequestRow[]): void;
  /** `findAll()` / `findOne()` → rejects (query-level failure). */
  mockSelectFailure(error: Error): void;
}

/**
 * @returns a fresh, independent mock per call — create one in `beforeEach` so
 * no assertion can leak between tests.
 */
export function createCallbackRequestsQueryMock(): CallbackRequestsQueryMock {
  const insertReturning = jest.fn<() => Promise<CallbackRequestRow[]>>();
  const insertValues = jest.fn<
    (values: NewCallbackRequestRow) => { returning: ReturningMock }
  >(() => ({ returning: insertReturning }));
  const insert = jest.fn<(table: unknown) => { values: ValuesMock }>(() => ({
    values: insertValues,
  }));

  const selectLimit =
    jest.fn<(count: number) => Promise<CallbackRequestRow[]>>();
  const selectOrderBy =
    jest.fn<(column: unknown) => Promise<CallbackRequestRow[]>>();
  const selectWhere = jest.fn<(condition: unknown) => { limit: LimitMock }>(
    () => ({ limit: selectLimit }),
  );
  const selectFrom = jest.fn<() => { where: WhereMock; orderBy: OrderByMock }>(
    () => ({ where: selectWhere, orderBy: selectOrderBy }),
  );
  const select = jest.fn<() => { from: FromMock }>(() => ({
    from: selectFrom,
  }));

  return {
    db: { insert, select } as unknown as Database,
    insert,
    insertValues,
    insertReturning,
    select,
    selectFrom,
    selectWhere,
    selectLimit,
    selectOrderBy,

    mockCreateResult: (rows) => insertReturning.mockResolvedValue(rows),
    // Rejections are produced per call (`mockImplementation`) instead of with
    // `mockRejectedValue`: the latter creates ONE rejected promise up front, so
    // a chain link the test never reaches (e.g. `limit` in a `findAll` failure
    // case) would leave an unhandled rejection and crash the Jest worker.
    //
    // `mockInsertFailure` throws SYNCHRONOUSLY from `insert()` on purpose: a
    // rejection at `.values()` would return a promise where the repository
    // expects a builder (`values()` is not terminal), which breaks the chain and
    // orphans the rejection instead of modelling a real failure.
    mockInsertFailure: (error) =>
      insert.mockImplementation(() => {
        throw error;
      }),
    mockCreateFailure: (error) =>
      insertReturning.mockImplementation(() => Promise.reject(error)),
    mockSelectResult: (rows) => {
      selectOrderBy.mockResolvedValue(rows);
      selectLimit.mockResolvedValue(rows);
    },
    mockSelectFailure: (error) => {
      selectOrderBy.mockImplementation(() => Promise.reject(error));
      selectLimit.mockImplementation(() => Promise.reject(error));
    },
  };
}
