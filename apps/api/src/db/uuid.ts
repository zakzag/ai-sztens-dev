/**
 * Pure UUID syntax check used before a query is issued.
 *
 * Kept as a standalone helper (no repository, no imports) so it can be reused by
 * the DTO validation added in AIS-38 without pulling in database code, and so
 * every branch is trivially unit-testable.
 */

/** Canonical dashed RFC 4122 form: `8-4-4-4-12` hex digits. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param value Candidate id from a path parameter or an internal call.
 * @returns `true` only for the canonical dashed form (the nil UUID
 * `00000000-0000-0000-0000-000000000000` included, since it is syntactically
 * valid — whether such a row exists is the query's business, not this check's).
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
