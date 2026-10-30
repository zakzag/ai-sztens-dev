import { isIdentifierConflict } from './api-keys.error-guard.js';
import {
  PostgresErrorMock,
  wrapDrizzleQueryError,
} from './test/mocks/database.mock.js';

/**
 * Unit tests for the `23505` classifier.
 *
 * This is the function that decides between “409 Conflict” and “500” for every
 * insert, so the false-positive branch (a different unique constraint) is tested
 * as carefully as the happy one: reporting an unrelated constraint as a
 * duplicate identifier would send the admin UI chasing a key that does not
 * exist.
 *
 * The wrapping cases exist because the first live smoke test answered 500 for a
 * duplicate: Drizzle throws `DrizzleQueryError` and the SQLSTATE sits on its
 * `cause`, not on the caught value.
 */

describe('isIdentifierConflict', () => {
  it('returns true for 23505 on api_keys_identifier_key', () => {
    expect(
      isIdentifierConflict(
        new PostgresErrorMock('23505', 'api_keys_identifier_key'),
      ),
    ).toBe(true);
  });

  it('returns true for 23505 without a constraint name', () => {
    expect(isIdentifierConflict(new PostgresErrorMock('23505'))).toBe(true);
  });

  it('returns false for 23505 on another constraint', () => {
    expect(
      isIdentifierConflict(new PostgresErrorMock('23505', 'api_keys_pkey')),
    ).toBe(false);
  });

  it('returns false for a different SQLSTATE', () => {
    expect(
      isIdentifierConflict(
        new PostgresErrorMock('23503', 'api_keys_identifier_key'),
      ),
    ).toBe(false);
  });

  it('returns true when Drizzle wraps the driver error (the live case)', () => {
    const driverError = new PostgresErrorMock(
      '23505',
      'api_keys_identifier_key',
    );

    expect(isIdentifierConflict(wrapDrizzleQueryError(driverError))).toBe(true);
  });

  it('returns false when a wrapped 23505 belongs to another constraint', () => {
    const driverError = new PostgresErrorMock('23505', 'api_keys_name_key');

    expect(isIdentifierConflict(wrapDrizzleQueryError(driverError))).toBe(
      false,
    );
  });

  it('walks a two-level cause chain', () => {
    const driverError = new PostgresErrorMock(
      '23505',
      'api_keys_identifier_key',
    );

    expect(
      isIdentifierConflict(
        wrapDrizzleQueryError(wrapDrizzleQueryError(driverError)),
      ),
    ).toBe(true);
  });

  it('accepts the alternative `constraint` spelling', () => {
    expect(
      isIdentifierConflict({
        code: '23505',
        constraint: 'api_keys_identifier_key',
      }),
    ).toBe(true);
  });

  it('accepts a plain object carrying code and constraint_name', () => {
    expect(
      isIdentifierConflict({
        code: '23505',
        constraint_name: 'api_keys_identifier_key',
      }),
    ).toBe(true);
  });

  it('returns false for a plain Error', () => {
    expect(isIdentifierConflict(new Error('boom'))).toBe(false);
  });

  it('returns false for null and primitives', () => {
    expect(isIdentifierConflict(null)).toBe(false);
    expect(isIdentifierConflict(undefined)).toBe(false);
    expect(isIdentifierConflict('23505')).toBe(false);
    expect(isIdentifierConflict(23505)).toBe(false);
  });

  it('returns false for an array (not an error object)', () => {
    expect(isIdentifierConflict(['23505'])).toBe(false);
  });

  it('stops after the cause-depth limit instead of looping forever', () => {
    const looped: { cause?: unknown; code?: string } = { code: '42P01' };
    looped.cause = looped;

    expect(isIdentifierConflict(looped)).toBe(false);
  });
});
