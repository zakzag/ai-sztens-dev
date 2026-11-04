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

import { dateOnlyToLocalIsoInstant } from '@callback/shared';
import {
  DATETIME_FORMAT_OPTIONS,
  EXPIRY_FORMAT_OPTIONS,
  EXPIRY_LOCALE,
  INVALID_EXPIRY_LABEL,
  INVALID_TIMESTAMP_LABEL,
  NO_EXPIRY_LABEL,
} from './date.const.js';

/** Stateless formatter, created once instead of per render. */
const expiryFormatter = new Intl.DateTimeFormat(
  EXPIRY_LOCALE,
  EXPIRY_FORMAT_OPTIONS,
);

/** Stateless formatter of a full timestamp, created once. */
const dateTimeFormatter = new Intl.DateTimeFormat(
  EXPIRY_LOCALE,
  DATETIME_FORMAT_OPTIONS,
);

/**
 * Converts a `<input type="date">` value into the ISO instant the API expects.
 *
 * The conversion itself moved into `@callback/shared` (`lib/date-only.ts`,
 * AIS-112 plan `D5`), because the same calendar-day ⇄ instant rule is needed by
 * every form, not only by this one. The semantics are unchanged: the day is the
 * **browser's** local day, so choosing `2026-11-01` stores “the moment
 * 2026-11-01 starts where I am”, not UTC midnight.
 *
 * @param dateInput - value of the date input (`YYYY-MM-DD`); may be empty.
 * @returns `undefined` for an empty/blank input — meaning “no expiry”, which
 *   the caller must **omit** from the request body (not send as `null`).
 * @throws {RangeError} when the input is not a real calendar date
 *   (wrong shape, or e.g. `2026-02-31`). The form validates the shape with zod
 *   before submitting; throwing here means a caller bypassed that validation.
 */
export function toExpiryIso(dateInput: string): string | undefined {
  return dateOnlyToLocalIsoInstant(dateInput);
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

/**
 * Renders a `createdAt` / `updatedAt` instant for the UI.
 *
 * @param iso - ISO 8601 instant from the API.
 * @returns the local date and time, or {@link INVALID_TIMESTAMP_LABEL} when the
 *   value cannot be parsed (visible on purpose: a broken timestamp is a contract
 *   violation, not something to hide behind an empty cell).
 */
export function formatDateTime(iso: string): string {
  const instant = new Date(iso);

  if (Number.isNaN(instant.getTime())) {
    return INVALID_TIMESTAMP_LABEL;
  }

  return dateTimeFormatter.format(instant);
}

/**
 * Converts an ISO instant back into a `<input type="date">` value.
 *
 * The inverse of {@link toExpiryIso}, and the reason an edit form can round-trip
 * a stored expiry without shifting the day: both directions use the **browser's**
 * local calendar, so `2026-11-01` → instant → `2026-11-01`.
 *
 * @param iso - ISO 8601 instant, or `null` when there is no expiry.
 * @returns `YYYY-MM-DD` in local time, or `''` for `null` and for an
 *   unparsable value (the form then starts empty and the user re-picks a day).
 */
export function toDateInputValue(iso: string | null): string {
  if (iso === null) {
    return '';
  }

  const instant = new Date(iso);

  if (Number.isNaN(instant.getTime())) {
    return '';
  }

  const year = instant.getFullYear();
  const month = String(instant.getMonth() + 1).padStart(2, '0');
  const day = String(instant.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
