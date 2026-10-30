/**
 * Date helpers of the `expiresAt` field (decision **D6** of the AIS-57 plan).
 *
 * The database column is a `timestamptz` and the wire contract carries an ISO
 * 8601 instant, while `<input type="date">` only knows a *calendar day*. Sending
 * that day as-is (`2026-11-01`) would be read as UTC midnight and, in
 * `Europe/Budapest`, shown as `2026-11-01 02:00` — or even shifted to the
 * previous day by a formatter. Both directions are therefore explicit here:
 *
 * - {@link toExpiryIso}: calendar day → **local** midnight → ISO instant;
 * - {@link formatExpiry}: ISO instant → local calendar day for display.
 *
 * Both functions are pure; the “now” clock is never read.
 */

import {
  DATE_INPUT_PATTERN,
  EXPIRY_FORMAT_OPTIONS,
  EXPIRY_LOCALE,
  INVALID_DATE_INPUT_MESSAGE,
  INVALID_EXPIRY_LABEL,
  NO_EXPIRY_LABEL,
} from './date.const.js';

/** Stateless formatter, created once instead of per render. */
const expiryFormatter = new Intl.DateTimeFormat(
  EXPIRY_LOCALE,
  EXPIRY_FORMAT_OPTIONS,
);

/**
 * Converts a `<input type="date">` value into the ISO instant the API expects.
 *
 * The day is interpreted in the **browser's** timezone (local midnight), which
 * is what the user sees in the date picker: choosing `2026-11-01` stores “the
 * moment 2026-11-01 starts where I am”, not UTC midnight.
 *
 * @param dateInput - value of the date input (`YYYY-MM-DD`); may be empty.
 * @returns `undefined` for an empty/blank input — meaning “no expiry”, which
 *   the caller must **omit** from the request body (not send as `null`).
 * @throws {RangeError} when the input is not a real calendar date
 *   (wrong shape, or e.g. `2026-02-31`). The form validates the shape with zod
 *   before submitting; throwing here means a caller bypassed that validation.
 */
export function toExpiryIso(dateInput: string): string | undefined {
  const trimmed = dateInput.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const match = DATE_INPUT_PATTERN.exec(trimmed);

  if (match === null) {
    throw new RangeError(INVALID_DATE_INPUT_MESSAGE);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const localMidnight = new Date(year, month - 1, day, 0, 0, 0, 0);

  // A non-existent day (`2026-02-31`) rolls over silently in `Date`, so the
  // components are compared back instead of trusting the constructor.
  const isRealDate =
    localMidnight.getFullYear() === year &&
    localMidnight.getMonth() === month - 1 &&
    localMidnight.getDate() === day;

  if (!isRealDate) {
    throw new RangeError(INVALID_DATE_INPUT_MESSAGE);
  }

  return localMidnight.toISOString();
}

/**
 * Renders an `expiresAt` instant for the UI.
 *
 * @param iso - ISO 8601 instant from the API, or `null` when there is no expiry.
 * @returns the local calendar day, {@link NO_EXPIRY_LABEL} for `null`, or
 *   {@link INVALID_EXPIRY_LABEL} when the value cannot be parsed (a contract
 *   violation that must be visible, not silently rendered as “nincs lejárat”).
 */
export function formatExpiry(iso: string | null): string {
  if (iso === null) {
    return NO_EXPIRY_LABEL;
  }

  const instant = new Date(iso);

  if (Number.isNaN(instant.getTime())) {
    return INVALID_EXPIRY_LABEL;
  }

  return expiryFormatter.format(instant);
}
