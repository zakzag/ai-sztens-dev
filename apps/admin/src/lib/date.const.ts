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

/** Rendered when a key has no `expiresAt` (`null` in the wire contract). */
export const NO_EXPIRY_LABEL = 'nincs lejárat';

/**
 * Layout of a rendered timestamp (created/updated).
 *
 * Date **and** time, because two versions of the same row usually differ by
 * minutes — a day-only format would render “2026. 11. 04.” twice and hide the
 * change the `updatedAt` token is about.
 */
export const DATETIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
};

/** Rendered when a timestamp is present but not parsable (contract violation). */
export const INVALID_TIMESTAMP_LABEL = 'érvénytelen időpont';

/** Rendered when `expiresAt` is present but not a parsable timestamp. */
export const INVALID_EXPIRY_LABEL = 'érvénytelen dátum';
