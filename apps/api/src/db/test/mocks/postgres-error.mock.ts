/**
 * Doubles for the Postgres driver errors the API classifies (AIS-178).
 *
 * Kept in the `db` test folder rather than in a feature's folder, because more
 * than one feature classifies `23505` and a second copy of the constraint-name
 * spelling would drift from the first.
 *
 * The field name mirrors `postgres.js`, which reports the violated constraint as
 * `constraint_name` — the first live smoke test showed the difference matters
 * (the classifier must not depend on the other spelling).
 */

/** A `postgres.js`-shaped unique-violation error. */
export class PostgresErrorMock extends Error {
  /** SQLSTATE, e.g. `23505`. */
  public readonly code: string;

  /** Violated constraint name, as `postgres.js` reports it. */
  public readonly constraint_name?: string;

  constructor(code: string, constraint?: string) {
    super(`scripted postgres error ${code}`);
    this.name = 'PostgresErrorMock';
    this.code = code;
    this.constraint_name = constraint;
  }
}

/**
 * Wraps a driver error the way Drizzle does (`DrizzleQueryError`).
 *
 * @param cause - the underlying `postgres.js` error.
 * @returns an error whose only relevant property is `cause`.
 */
export function wrapDrizzleQueryError(cause: unknown): Error {
  return new Error('Failed query: insert into "customer"."customers" …', {
    cause,
  });
}
