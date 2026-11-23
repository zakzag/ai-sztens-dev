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
 * @param value - a nullable stored timestamp **or a raw SQL projection value**.
 * @returns the ISO 8601 string, or `null` when the column is empty.
 *
 * The `string` arm exists because a derived column (`sql<Date | null>` over a
 * subquery) has no Drizzle decoder, so the driver hands back the textual
 * timestamp rather than a `Date`. Trusting the type annotation there made
 * `GET /api/admin/customers/:id` fail with `value.toISOString is not a
 * function` (AIS-14 R1). A value that is neither shape throws instead of
 * silently becoming `Invalid Date`.
 */
export function toNullableIsoString(
  value: Date | string | null,
): string | null {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(`Not a timestamp: ${JSON.stringify(value)}`);
  }

  return parsed.toISOString();
}
