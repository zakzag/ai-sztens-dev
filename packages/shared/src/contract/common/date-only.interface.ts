/**
 * Parsed parts of a `YYYY-MM-DD` string.
 *
 * A named type instead of an inline shape, so the calendar helpers and their
 * tests agree on one contract.
 */
export interface DateOnlyParts {
  /** Four-digit year. */
  readonly year: number;
  /** Month, 1-based (`1` = January). */
  readonly month: number;
  /** Day of month, 1-based. */
  readonly day: number;
}
