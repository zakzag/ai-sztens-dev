/**
 * Constants of the date helpers.
 *
 * They live in a separate file so the UI texts (and the locale) are greppable
 * and translatable in one place instead of being sprinkled through the pure
 * functions.
 */

/**
 * Locale of the rendered dates.
 *
 * `hu-HU` because the admin UI is Hungarian; the *value* is unchanged (a date is
 * not translated, only its layout is).
 */
export const EXPIRY_LOCALE = 'hu-HU';

/**
 * Layout of a rendered expiry.
 *
 * Numeric year-month-day, so two rows can be compared at a glance without
 * parsing month names.
 */
export const EXPIRY_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

/** Shape `<input type="date">` produces (and the only accepted input shape). */
export const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Rendered when a key has no `expiresAt` (`null` in the wire contract). */
export const NO_EXPIRY_LABEL = 'nincs lejárat';

/** Rendered when `expiresAt` is present but not a parsable timestamp. */
export const INVALID_EXPIRY_LABEL = 'érvénytelen dátum';

/** Message of the `RangeError` thrown for a malformed `<input type="date">` value. */
export const INVALID_DATE_INPUT_MESSAGE =
  'The date input must be a valid calendar date in YYYY-MM-DD format.';
