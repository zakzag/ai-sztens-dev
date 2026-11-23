/**
 * Recognition of a Postgres error behind an arbitrary (wrapped) throwable
 * (AIS-178).
 *
 * Why this is a shared helper and not a private function of one feature: the
 * decision “was this failure a unique-constraint violation on **that** column?”
 * is the same decision for every resource that maps a `23505` to a `409`. Making
 * it a pure function in the `db` layer means a feature cannot invent its own
 * matching rule — and, more importantly, cannot start matching on message text.
 *
 * Two facts about the error shape, learned from the first live smoke test
 * (2026-10-21) and encoded here:
 *
 * 1. **The driver error is wrapped.** Drizzle throws a `DrizzleQueryError` whose
 *    `cause` is the `postgres.js` `PostgresError`, so the SQLSTATE is one level
 *    down. The lookup therefore walks the `cause` chain instead of inspecting
 *    only the value that was caught.
 * 2. **The constraint has two spellings.** `postgres.js` reports
 *    `constraint_name`; some wrappers and drivers report `constraint`. Both are
 *    accepted, because a false negative here turns a `409` into a `500`.
 *
 * Only **structured** fields are trusted. Postgres messages are locale- and
 * version-dependent, so text matching would break silently on the first server
 * upgrade — and again in Hungarian.
 */

/**
 * How far the `cause` chain is followed.
 *
 * Deep enough for the Drizzle → postgres.js nesting (plus one additional
 * wrapper), low enough that a self-referencing `cause` cannot spin forever.
 */
const MAX_CAUSE_DEPTH = 5;

/** Postgres SQLSTATE of a unique-constraint violation. */
export const PG_UNIQUE_VIOLATION_CODE = '23505';

/**
 * Postgres SQLSTATE of a foreign-key violation (AIS-178, slice d).
 *
 * A *semantic* failure rather than a conflict: the payload is well formed, but a
 * reference it carries does not exist — or exists in a scope that does not match
 * (a contact pointing at another customer's login user).
 */
export const PG_FOREIGN_KEY_VIOLATION_CODE = '23503';

/** A non-null, non-array object — the only shape that can carry driver fields. */
interface UnknownRecord {
  readonly [key: string]: unknown;
}

/**
 * What to look for on the error (or on one of its causes).
 *
 * `constraintName` is optional on purpose: when a driver does not report it,
 * refusing to classify would mean every collision becomes a `500`.
 */
export interface PostgresErrorLookup {
  /** SQLSTATE to match, e.g. `23505`. */
  readonly code: string;

  /**
   * Constraint (or index) name to match, e.g. `customers_tax_number_key`.
   *
   * When absent from the error the code alone decides; when present it must
   * match, so a second unique constraint on the same table is never reported as
   * the first one.
   */
  readonly constraintName?: string;
}

/** @returns `true` for a non-null, non-array object. */
function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads the violated constraint name from either supported field spelling.
 *
 * @param error - the record under inspection.
 * @returns the constraint name, or `undefined` when it is not reported.
 */
export function readPostgresConstraintName(
  error: UnknownRecord,
): string | undefined {
  const raw = error['constraint_name'] ?? error['constraint'];

  return typeof raw === 'string' ? raw : undefined;
}

/**
 * Decides whether a (possibly wrapped) error is the Postgres failure described
 * by `lookup`.
 *
 * The walk stops at the first record that carries the requested SQLSTATE: a
 * matching code is a decision, it is not overridden by a cause further down.
 *
 * @param error - value caught around a database call (`unknown` under `strict`).
 * @param lookup - the SQLSTATE and, optionally, the constraint to match.
 * @returns `true` when the error (or a cause of it) is that exact failure.
 */
export function findPostgresError(
  error: unknown,
  lookup: PostgresErrorLookup,
): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (!isRecord(current)) {
      return false;
    }

    if (current['code'] === lookup.code) {
      const constraint = readPostgresConstraintName(current);

      if (lookup.constraintName === undefined) {
        return true;
      }

      return constraint === undefined || constraint === lookup.constraintName;
    }

    current = current['cause'];
  }

  return false;
}
