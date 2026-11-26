/**
 * JSONB narrowing shared by the activity feed and the audit-log reader
 * (AIS-178, slice f).
 *
 * Both tables store a `jsonb` column whose Drizzle row type is `unknown`
 * (`activity.activities.metadata`, `audit.audit_logs.before_data` / `after_data`),
 * while the wire contract declares `Record<string, unknown> | null`. A single
 * pure pair of functions does that narrowing, so the two mappers cannot drift
 * apart and neither of them needs a cast.
 *
 * Why arrays are rejected: a JSON array is a legal `jsonb` value but not a legal
 * "record of fields", and the contract's `z.record(z.unknown())` rejects it. If
 * the narrowing accepted an array, the response would parse on the server and
 * fail in the client's `auditLogSchema`.
 */

/**
 * @param value - any value read from a `jsonb` column.
 * @returns `true` for a non-null, non-array object.
 */
export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Narrows a `jsonb` column value to the record shape of the contract.
 *
 * `null` (and any non-record value, e.g. a scalar or an array written by an
 * older client) becomes `null`, which the contract allows: the payload is
 * optional data, never a required field.
 *
 * @param value - any value read from a `jsonb` column.
 * @returns the record, or `null` when the value is not one.
 */
export function toJsonRecord(value: unknown): Record<string, unknown> | null {
  return isJsonRecord(value) ? value : null;
}
