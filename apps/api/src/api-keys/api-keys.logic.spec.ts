import { isPastDate } from './api-keys.logic.js';

/**
 * Unit tests for the pure business rules (AIS-108).
 *
 * `now` is a parameter, so no fake timers are involved: the boundary case
 * (`expiresAt === now`) is testable exactly, which is the whole reason the rule
 * does not read the clock itself.
 */

/** Reference instant used by every test below. */
const NOW = new Date('2026-11-02T12:00:00.000Z');

describe('isPastDate', () => {
  it('returns true for an instant before now', () => {
    expect(isPastDate('2026-11-02T11:59:59.999Z', NOW)).toBe(true);
  });

  it('returns true for a much earlier instant', () => {
    expect(isPastDate('2020-01-01T00:00:00.000Z', NOW)).toBe(true);
  });

  it('returns false for an instant equal to now (the boundary is allowed)', () => {
    // `expiresAt === now` is a deliberate input, not a typo — rejecting it
    // would make the rule depend on clock precision.
    expect(isPastDate('2026-11-02T12:00:00.000Z', NOW)).toBe(false);
  });

  it('returns false for an instant after now', () => {
    expect(isPastDate('2026-11-02T12:00:00.001Z', NOW)).toBe(false);
  });

  it('returns false for a far future instant', () => {
    expect(isPastDate('2030-01-01T00:00:00.000Z', NOW)).toBe(false);
  });

  it('respects the offset form of an ISO timestamp', () => {
    // 13:00+01:00 is 12:00Z — the same instant as `now`, so still allowed.
    expect(isPastDate('2026-11-02T13:00:00+01:00', NOW)).toBe(false);
    expect(isPastDate('2026-11-02T12:59:59+01:00', NOW)).toBe(true);
  });

  it('returns false for an unparsable timestamp (shape is zod’s job)', () => {
    // The schema already answered 400 for this, so the rule must not turn a
    // parse failure into a competing 422.
    expect(isPastDate('not-a-date', NOW)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isPastDate('', NOW)).toBe(false);
  });
});
