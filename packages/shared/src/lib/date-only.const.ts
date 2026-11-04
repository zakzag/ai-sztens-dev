/**
 * Constants of the calendar-day ⇄ instant conversion.
 *
 * The message is **internal** (English): it is thrown as a `RangeError`, which
 * means a caller bypassed validation — a bug to fix, never copy to show.
 */

/** Thrown when a value is not a real calendar day. */
export const INVALID_DATE_ONLY_MESSAGE =
  'Expected a real calendar day in YYYY-MM-DD form.';
