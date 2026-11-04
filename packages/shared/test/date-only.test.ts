import {
  VALIDATION_MESSAGE_CATALOGUE,
  dateOnlySchema,
  dateOnlyToLocalIsoInstant,
  isValidDateOnly,
  parseDateOnly,
  toLocalDateOnly,
} from '../src/index.js';
import { firstMessage } from './lib/validation.helper.js';

/**
 * Unit tests of the calendar-day schema and its two conversions (AIS-112 `D5`).
 *
 * The timezone-sensitive assertions are written against a `new Date(y, m, d)`
 * built the same way as the implementation, so the suite passes on any machine:
 * what is being tested is the *local midnight* semantics, not a fixed offset.
 */

const ENGLISH = VALIDATION_MESSAGE_CATALOGUE.en;

describe('dateOnlySchema', () => {
  it('accepts a real calendar day', () => {
    expect(dateOnlySchema.safeParse('2026-11-04').success).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(dateOnlySchema.safeParse(' 2026-11-04 ').success).toBe(true);
  });

  it('accepts 29 February in a leap year', () => {
    expect(dateOnlySchema.safeParse('2024-02-29').success).toBe(true);
  });

  it('rejects 29 February in a non-leap year', () => {
    expect(firstMessage(dateOnlySchema, '2026-02-29')).toBe(ENGLISH.DATE_ONLY);
  });

  it('rejects 31 April', () => {
    expect(firstMessage(dateOnlySchema, '2026-04-31')).toBe(ENGLISH.DATE_ONLY);
  });

  it('rejects month 13', () => {
    expect(firstMessage(dateOnlySchema, '2026-13-01')).toBe(ENGLISH.DATE_ONLY);
  });

  it('rejects month 0', () => {
    expect(firstMessage(dateOnlySchema, '2026-00-10')).toBe(ENGLISH.DATE_ONLY);
  });

  it('rejects day 0', () => {
    expect(firstMessage(dateOnlySchema, '2026-01-00')).toBe(ENGLISH.DATE_ONLY);
  });

  it('rejects a non-padded form', () => {
    expect(firstMessage(dateOnlySchema, '2026-1-1')).toBe(ENGLISH.DATE_ONLY);
  });

  it('rejects a dotted form', () => {
    expect(firstMessage(dateOnlySchema, '2026.11.04')).toBe(ENGLISH.DATE_ONLY);
  });

  it('rejects a full instant', () => {
    expect(firstMessage(dateOnlySchema, '2026-11-04T00:00:00Z')).toBe(
      ENGLISH.DATE_ONLY,
    );
  });

  it('rejects an empty value', () => {
    expect(firstMessage(dateOnlySchema, '')).toBe(ENGLISH.DATE_ONLY);
  });
});

describe('parseDateOnly', () => {
  it('returns the parts of a valid day', () => {
    expect(parseDateOnly('2026-11-04')).toEqual({
      year: 2026,
      month: 11,
      day: 4,
    });
  });

  it('returns null for an impossible day', () => {
    expect(parseDateOnly('2026-02-30')).toBeNull();
  });

  it('agrees with isValidDateOnly', () => {
    expect(isValidDateOnly('2024-02-29')).toBe(true);
    expect(isValidDateOnly('2026-02-29')).toBe(false);
  });
});

describe('dateOnlyToLocalIsoInstant', () => {
  it('converts a day to that day’s local midnight', () => {
    expect(dateOnlyToLocalIsoInstant('2026-11-01')).toBe(
      new Date(2026, 10, 1, 0, 0, 0, 0).toISOString(),
    );
  });

  it('returns undefined for an empty value, i.e. “no date”', () => {
    expect(dateOnlyToLocalIsoInstant('')).toBeUndefined();
    expect(dateOnlyToLocalIsoInstant('   ')).toBeUndefined();
  });

  it('throws a RangeError for a non-calendar day', () => {
    expect(() => dateOnlyToLocalIsoInstant('2026-02-31')).toThrow(RangeError);
  });
});

describe('toLocalDateOnly', () => {
  it('renders the local day of an instant', () => {
    expect(toLocalDateOnly(new Date(2026, 10, 1, 12, 30))).toBe('2026-11-01');
  });

  it('accepts an ISO string', () => {
    expect(toLocalDateOnly(new Date(2026, 0, 5, 8).toISOString())).toBe(
      '2026-01-05',
    );
  });

  it('returns null for an unparsable instant', () => {
    expect(toLocalDateOnly('not a date')).toBeNull();
  });

  it('round-trips with dateOnlyToLocalIsoInstant', () => {
    const instant = dateOnlyToLocalIsoInstant('2027-01-31');

    expect(instant).toBeDefined();
    expect(toLocalDateOnly(instant ?? '')).toBe('2027-01-31');
  });
});
