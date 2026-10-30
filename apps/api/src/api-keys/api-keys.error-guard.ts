/**
 * Narrowing helpers that turn an `unknown` driver error into a decision.
 *
 * The `catch` parameter is `unknown` (strict mode), and the decision “was this a
 * duplicate identifier?” must never be based on message text: Postgres messages
 * are locale- and version-dependent. Only the structured fields are trusted.
 *
 * Two details, both learned from the first live smoke test (2026-10-21), are
 * encoded here:
 *
 * 1. **The error is wrapped.** Drizzle throws a `DrizzleQueryError` whose `cause`
 *    is the `postgres.js` `PostgresError`, so the SQLSTATE is one level down.
 *    The check therefore walks the `cause` chain instead of looking only at the
 *    value that was caught.
 * 2. **The field name is `constraint_name`.** `postgres.js` names the violated
 *    constraint that way; `constraint` is accepted too because pooled/wrapped
 *    errors and other drivers may use it.
 */

import {
  API_KEY_IDENTIFIER_CONSTRAINT,
  PG_UNIQUE_VIOLATION_CODE,
} from './api-keys.const.js';

/**
 * How far the `cause` chain is followed.
 *
 * Deep enough for the Drizzle → postgres.js nesting (and one more wrapper), low
 * enough that a self-referencing `cause` cannot spin forever.
 */
const MAX_CAUSE_DEPTH = 5;

interface UnknownRecord {
  readonly [key: string]: unknown;
}

/** @returns `true` for a non-null, non-array object. */
function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads the violated constraint name from either supported field spelling.
 *
 * @returns the constraint name, or `undefined` when the error does not carry it.
 */
function readConstraintName(error: UnknownRecord): string | undefined {
  const raw = error['constraint_name'] ?? error['constraint'];
  return typeof raw === 'string' ? raw : undefined;
}

/**
 * Detects a duplicate `identifier` from a (possibly wrapped) driver error.
 *
 * Primary signal is SQLSTATE `23505`, searched along the `cause` chain. When the
 * error also exposes the violated constraint name, it must be
 * `api_keys_identifier_key` — that keeps a future second unique constraint from
 * being reported as an identifier conflict. When the name is absent, the code
 * alone is accepted, because the table currently has exactly one unique
 * constraint.
 *
 * @param error - value caught from the insert.
 * @returns `true` when the insert was rejected by the identifier constraint.
 */
export function isIdentifierConflict(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (!isRecord(current)) {
      return false;
    }

    if (current['code'] === PG_UNIQUE_VIOLATION_CODE) {
      const constraint = readConstraintName(current);
      return (
        constraint === undefined || constraint === API_KEY_IDENTIFIER_CONSTRAINT
      );
    }

    current = current['cause'];
  }

  return false;
}
