/**
 * Calendar-day helpers of the shared contract (AIS-112).
 *
 * A `dateOnly` is a **day without a timezone** (`2026-11-04`), which is what an
 * `<input type="date">` produces. It is deliberately not a `Date`: a `Date` is
 * an instant, and converting between the two silently depends on the ambient
 * timezone. That conversion lives in
 * [`lib/date-only.ts`](../../lib/date-only.ts:1), where the dependency is
 * documented, and this module stays timezone-free.
 */

import { DATE_ONLY_LENGTH, DATE_ONLY_PATTERN } from './format.const.js';
import type { DateOnlyParts } from './date-only.interface.js';

/**
 * @param year - the year to test.
 * @returns `true` when the year has 29 February.
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * @param year - the year of the date.
 * @param month - 1-based month.
 * @returns the number of days in that month.
 */
function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

/**
 * Splits a `YYYY-MM-DD` string and checks that the day really exists.
 *
 * The calendar check is what rejects `2026-02-29` and `2026-04-31`: a shape-only
 * regex would accept both, and Postgres would then either roll the value over
 * or reject the row.
 *
 * @param value - the candidate string.
 * @returns the parts, or `null` when the shape or the day is invalid.
 */
export function parseDateOnly(value: string): DateOnlyParts | null {
  if (value.length !== DATE_ONLY_LENGTH) {
    return null;
  }

  const match = DATE_ONLY_PATTERN.exec(value);

  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1) {
    return null;
  }

  if (day > daysInMonth(year, month)) {
    return null;
  }

  return { year, month, day };
}

/**
 * @param value - the candidate string.
 * @returns `true` when it is a real calendar day in `YYYY-MM-DD` form.
 */
export function isValidDateOnly(value: string): boolean {
  return parseDateOnly(value) !== null;
}
