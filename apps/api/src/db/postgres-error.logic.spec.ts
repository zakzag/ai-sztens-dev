import { PostgresErrorMock } from './test/mocks/postgres-error.mock.js';
import { findPostgresError } from './postgres-error.logic.js';

/**
 * Unit tests of the pure Postgres error classifier (AIS-178).
 *
 * The cases are the ones the classifier exists for: the error Drizzle wraps, the
 * two spellings of the constraint name, and every way a *different* failure must
 * **not** be mistaken for a unique-constraint violation — a false positive here
 * would report a connection problem as a business conflict.
 */

/** The lookup the `customers` feature uses for its duplicate tax number. */
const TAX_NUMBER_LOOKUP = {
  code: '23505',
  constraintName: 'customers_tax_number_key',
} as const;

describe('findPostgresError', () => {
  it('matches a direct driver error', () => {
    // No wrapper at all: `postgres.js` can surface the error as-is.
    const error = new PostgresErrorMock('23505', 'customers_tax_number_key');

    expect(findPostgresError(error, TAX_NUMBER_LOOKUP)).toBe(true);
  });

  it('matches an error wrapped the way Drizzle wraps it', () => {
    const error = new Error(
      'Failed query: insert into "customer"."customers"',
      {
        cause: new PostgresErrorMock('23505', 'customers_tax_number_key'),
      },
    );

    expect(findPostgresError(error, TAX_NUMBER_LOOKUP)).toBe(true);
  });

  it('matches the `constraint` spelling as well as `constraint_name`', () => {
    const error = { code: '23505', constraint: 'customers_tax_number_key' };

    expect(findPostgresError(error, TAX_NUMBER_LOOKUP)).toBe(true);
  });

  it('matches on the code alone when the driver reports no constraint name', () => {
    const error = new PostgresErrorMock('23505');

    expect(findPostgresError(error, TAX_NUMBER_LOOKUP)).toBe(true);
  });

  it('matches on the code alone when no constraint name is expected', () => {
    const error = new PostgresErrorMock('23505', 'something_else');

    expect(findPostgresError(error, { code: '23505' })).toBe(true);
  });

  it('rejects a different SQLSTATE', () => {
    const error = new PostgresErrorMock('23503', 'customers_tax_number_key');

    expect(findPostgresError(error, TAX_NUMBER_LOOKUP)).toBe(false);
  });

  it('rejects a 23505 from a different constraint', () => {
    const error = new PostgresErrorMock(
      '23505',
      'customers_customer_number_key',
    );

    expect(findPostgresError(error, TAX_NUMBER_LOOKUP)).toBe(false);
  });

  it('rejects a constraint conflict whose SQLSTATE differs', () => {
    const error = {
      code: '23000',
      constraint_name: 'customers_tax_number_key',
    };

    expect(findPostgresError(error, TAX_NUMBER_LOOKUP)).toBe(false);
  });

  it('rejects a non-object throwable', () => {
    expect(findPostgresError('23505', TAX_NUMBER_LOOKUP)).toBe(false);
    expect(findPostgresError(null, TAX_NUMBER_LOOKUP)).toBe(false);
    expect(findPostgresError(undefined, TAX_NUMBER_LOOKUP)).toBe(false);
  });

  it('rejects an array (arrays are objects but never driver errors)', () => {
    expect(findPostgresError([{ code: '23505' }], TAX_NUMBER_LOOKUP)).toBe(
      false,
    );
  });

  it('stops at the cause-chain depth limit instead of looping forever', () => {
    // A self-referencing cause is the pathological case: without the depth cap
    // this would never return.
    const error: { code: string; cause?: unknown } = { code: '99999' };
    error.cause = error;

    expect(findPostgresError(error, TAX_NUMBER_LOOKUP)).toBe(false);
  });

  it('finds the code five levels down', () => {
    let error: unknown = new PostgresErrorMock(
      '23505',
      'customers_tax_number_key',
    );

    for (let depth = 0; depth < 4; depth += 1) {
      error = new Error(`wrapper ${depth}`, { cause: error });
    }

    expect(findPostgresError(error, TAX_NUMBER_LOOKUP)).toBe(true);
  });

  it('gives up beyond the cause-chain depth limit', () => {
    let error: unknown = new PostgresErrorMock(
      '23505',
      'customers_tax_number_key',
    );

    for (let depth = 0; depth < 6; depth += 1) {
      error = new Error(`wrapper ${depth}`, { cause: error });
    }

    expect(findPostgresError(error, TAX_NUMBER_LOOKUP)).toBe(false);
  });
});
