/**
 * ISO 8601 helpers shared by the feature mappers (AIS-178).
 *
 * The wire contract is `Date.prototype.toISOString()` — millisecond precision,
 * `Z` suffix — and every mapper has to produce exactly that, otherwise a value
 * round-tripped through the API stops matching the column it came from.
 *
 * The two functions exist instead of an inline `.toISOString()` because the
 * difference between them is a decision: a nullable column must serialise as an
 * explicit `null`, never as `undefined` (a missing key would make "no value" and
 * "forgot the field" indistinguishable — API-Convention §4).
 */

/**
 * @param value - a stored timestamp.
 * @returns the same instant as an ISO 8601 string with milliseconds.
 */
export function toIsoString(value: Date): string {
  return value.toISOString();
}

/**
 * @param value - a nullable stored timestamp.
 * @returns the ISO 8601 string, or `null` when the column is empty.
 */
export function toNullableIsoString(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}
