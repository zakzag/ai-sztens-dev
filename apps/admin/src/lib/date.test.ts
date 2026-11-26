/**
 * Tests of the `expiresAt` conversions (plan decision **D6**).
 *
 * The key property is *not* a fixed ISO string (that would only re-assert the
 * machine's timezone) but the round trip: a calendar day must survive
 * `toExpiryIso` → `formatExpiry` unchanged, and the instant produced for a day
 * must be that day's **local** midnight.
 */

import { describe, expect, it } from 'vitest';
import {
  INVALID_EXPIRY_LABEL,
  INVALID_TIMESTAMP_LABEL,
  NO_EXPIRY_LABEL,
} from './date.const.js';
import {
  formatDateTime,
  formatExpiry,
  toDateInputValue,
  toExpiryIso,
} from './date.js';

/**
 * @param dateInput - a date-input value expected to be valid.
 * @returns the produced ISO instant, failing the test when none was produced.
 */
function requireIso(dateInput: string): string {
  const iso = toExpiryIso(dateInput);

  if (iso === undefined) {
    throw new Error(`expected "${dateInput}" to convert to an ISO instant`);
  }

  return iso;
}

describe('toExpiryIso', () => {
  it('returns undefined for an empty input (no expiry)', () => {
    expect(toExpiryIso('')).toBeUndefined();
  });

  it('returns undefined for a whitespace-only input', () => {
    expect(toExpiryIso('   ')).toBeUndefined();
  });

  it('converts a calendar day to that day 00:00 in the local timezone', () => {
    const instant = new Date(requireIso('2026-07-01'));

    expect(instant.getFullYear()).toBe(2026);
    expect(instant.getMonth()).toBe(6);
    expect(instant.getDate()).toBe(1);
    expect(instant.getHours()).toBe(0);
    expect(instant.getMinutes()).toBe(0);
  });

  it('keeps the local calendar day when formatted back', () => {
    const iso = requireIso('2026-11-01');
    const rendered = formatExpiry(iso);

    expect(rendered).toContain('2026');
    expect(rendered).toContain('11');
    expect(rendered).toContain('01');
  });

  it('accepts a day at the end of a month', () => {
    const instant = new Date(requireIso('2028-02-29'));

    expect(instant.getDate()).toBe(29);
    expect(instant.getMonth()).toBe(1);
  });

  it('throws for a non-ISO shaped input', () => {
    expect(() => toExpiryIso('2026.07.01')).toThrow(RangeError);
  });

  it('throws for a single-digit month or day', () => {
    expect(() => toExpiryIso('2026-7-1')).toThrow(RangeError);
  });

  it('throws for a calendar day that does not exist', () => {
    expect(() => toExpiryIso('2026-02-31')).toThrow(RangeError);
  });

  it('throws for a non-leap 29 February', () => {
    expect(() => toExpiryIso('2027-02-29')).toThrow(RangeError);
  });
});

describe('formatExpiry', () => {
  it('renders the "no expiry" label for null', () => {
    expect(formatExpiry(null)).toBe(NO_EXPIRY_LABEL);
  });

  it('renders the invalid label for an unparsable timestamp', () => {
    expect(formatExpiry('not-a-date')).toBe(INVALID_EXPIRY_LABEL);
  });

  it('renders the local calendar day of an instant', () => {
    const localNoon = new Date(2025, 0, 15, 12, 0, 0, 0);

    expect(formatExpiry(localNoon.toISOString())).toContain('2025');
    expect(formatExpiry(localNoon.toISOString())).toContain('15');
  });
});

describe('toDateInputValue', () => {
  it('returns an empty value for null and for an unparsable instant', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue('not-a-date')).toBe('');
  });

  it('round-trips a calendar day through toExpiryIso', () => {
    // The edit form depends on this: it shows the stored expiry as a date input
    // value and must send the same day back, not the UTC one.
    expect(toDateInputValue(requireIso('2027-02-01'))).toBe('2027-02-01');
  });

  it('renders the local day of an instant that is still the previous UTC day', () => {
    const localLateEvening = new Date(2026, 10, 4, 23, 30, 0, 0);

    expect(toDateInputValue(localLateEvening.toISOString())).toBe('2026-11-04');
  });
});

describe('formatDateTime', () => {
  it('renders the date and the time of an instant', () => {
    const localInstant = new Date(2026, 10, 4, 9, 5, 0, 0);

    expect(formatDateTime(localInstant.toISOString())).toContain('2026');
    expect(formatDateTime(localInstant.toISOString())).toContain('09');
  });

  it('renders the invalid label for an unparsable timestamp', () => {
    expect(formatDateTime('not-a-date')).toBe(INVALID_TIMESTAMP_LABEL);
  });
});
