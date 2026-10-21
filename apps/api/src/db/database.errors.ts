/**
 * Errors raised while wiring the database layer.
 *
 * These describe *configuration* problems, not query failures: a broken
 * configuration must stop the API at boot instead of degrading into a runtime
 * error on the first request (that was the failure mode of the old in-memory
 * store — requests "worked" while writing nothing anywhere durable).
 */

/**
 * Raised when the database cannot be configured at boot.
 *
 * Carries the offending variable name so the boot log says exactly what to fix,
 * and the message points at the documentation that lists every value needed for
 * a local run.
 */
export class DatabaseConfigurationError extends Error {
  /** The environment variable that caused the failure (e.g. `DATABASE_URL`). */
  public readonly variable: string;

  /** Why the value was rejected, without echoing the secret itself. */
  public readonly reason: string;

  constructor(variable: string, reason: string) {
    super(
      `${variable} ${reason}. Set it per environment (see ` +
        'docs/Specs/Database-Local.md §3 for local values); the API refuses to ' +
        'start without a database configuration.',
    );
    this.name = 'DatabaseConfigurationError';
    this.variable = variable;
    this.reason = reason;
  }
}
