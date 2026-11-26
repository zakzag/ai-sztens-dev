/**
 * Calendar day ⇄ ISO instant conversion (AIS-112 plan decision `D5`).
 *
 * The conversion moved here from `apps/admin/src/lib/date.ts` because it is a
 * **contract-level** rule: the wire carries an ISO instant, an
 * `<input type="date">` carries a calendar day, and both the admin form and the
 * eventual public form must convert the same way.
 *
 * The timezone dependency is the whole point of this file, so it is stated once:
 * a calendar day becomes the **local** midnight of that day. Writing
 * `2026-11-01T00:00:00Z` instead would store “01:00 or 02:00 on the 1st” in
 * `Europe/Budapest`, and any formatter west of UTC would show the previous day.
 * That is why {@link parseDateOnly} (no timezone) and this function (ambient
 * timezone) are separate modules.
 */

import { parseDateOnly } from '../contract/common/date-only.helper.js';
import { INVALID_DATE_ONLY_MESSAGE } from './date-only.const.js';

/**
 * Pads a number to two digits.
 *
 * @param value - the number to render.
 * @returns the value as `DD` / `MM`.
 */
function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Converts a calendar day into the ISO instant the API expects.
 *
 * @param dateOnly - the `<input type="date">` value; may be empty.
 * @returns `undefined` for an empty value — meaning “no date”, which the caller
 *   must **omit** from the request body rather than send as `null`.
 * @throws {RangeError} when the value is not a real calendar day; behind a
 *   schema this is unreachable, and it is loud on purpose.
 */
export function dateOnlyToLocalIsoInstant(dateOnly: string): string | undefined {
  const trimmed = dateOnly.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const parts = parseDateOnly(trimmed);

  if (parts === null) {
    throw new RangeError(`${INVALID_DATE_ONLY_MESSAGE} Received: ${trimmed}`);
  }

  return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0).toISOString();
}

/**
 * Renders the **local** calendar day of an instant.
 *
 * @param instant - an ISO 8601 instant, or a `Date`.
 * @returns `YYYY-MM-DD`, or `null` when the instant cannot be parsed — a
 *   contract violation the caller must surface, not silently default.
 */
export function toLocalDateOnly(instant: Date | string): string | null {
  const date = typeof instant === 'string' ? new Date(instant) : instant;

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}
