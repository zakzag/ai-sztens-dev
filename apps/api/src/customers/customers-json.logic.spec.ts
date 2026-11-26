import { isJsonRecord, toJsonRecord } from './customers-json.logic.js';

/**
 * Unit tests of the shared `jsonb` narrowing (AIS-178, slice f).
 *
 * The contract declares `Record<string, unknown> | null` for every `jsonb`-backed
 * field, so the only interesting cases are the values Postgres can hand back that
 * are **not** a record: `null`, a scalar and an array.
 */

describe('isJsonRecord', () => {
  it('accepts a plain object', () => {
    expect(isJsonRecord({ a: 1 })).toBe(true);
  });

  it('accepts an empty object', () => {
    expect(isJsonRecord({})).toBe(true);
  });

  it('rejects null', () => {
    expect(isJsonRecord(null)).toBe(false);
  });

  it('rejects an array', () => {
    expect(isJsonRecord([{ a: 1 }])).toBe(false);
  });

  it('rejects a scalar', () => {
    expect(isJsonRecord('note')).toBe(false);
    expect(isJsonRecord(0)).toBe(false);
    expect(isJsonRecord(true)).toBe(false);
  });
});

describe('toJsonRecord', () => {
  it('returns the record unchanged', () => {
    const payload = { durationSeconds: 92, outcome: 'answered' };

    expect(toJsonRecord(payload)).toBe(payload);
  });

  it('returns null for a missing value', () => {
    expect(toJsonRecord(null)).toBeNull();
    expect(toJsonRecord(undefined)).toBeNull();
  });

  it('returns null for an array, which the contract cannot carry', () => {
    expect(toJsonRecord([1, 2, 3])).toBeNull();
  });

  it('returns null for a scalar written by an older client', () => {
    expect(toJsonRecord('legacy')).toBeNull();
  });
});
