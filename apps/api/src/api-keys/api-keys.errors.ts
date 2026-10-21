/**
 * Domain errors of the `api-keys` feature.
 *
 * They are raised by the *repository* (the only layer that talks to Postgres)
 * and translated into HTTP exceptions by the *service*. Keeping them free of
 * `@nestjs/common` is deliberate: the persistence layer must stay usable from a
 * migration script or a future worker, where “HTTP 409” means nothing.
 */

/**
 * Raised when the `api_keys_identifier_key` unique constraint rejected an
 * insert, i.e. another row already owns the requested `identifier`.
 *
 * Carries the identifier so the service can build a useful 409 message without
 * re-reading the database, and the original driver error as `cause` so the log
 * still shows the SQLSTATE and constraint name.
 */
export class ApiKeyIdentifierConflictError extends Error {
  /** The identifier that already exists. */
  public readonly identifier: string;

  constructor(identifier: string, cause: unknown) {
    super(
      `An API key with identifier "${identifier}" already exists ` +
        '(unique constraint api_keys_identifier_key).',
      { cause },
    );
    this.name = 'ApiKeyIdentifierConflictError';
    this.identifier = identifier;
  }
}

/**
 * Raised when an insert reported success but returned no row.
 *
 * `INSERT … RETURNING` is expected to return exactly one row; if it does not,
 * something is deeply wrong (wrong table, a trigger swallowing the row, a
 * connection-level spoof). Failing loudly here is better than returning
 * `undefined` and letting the caller send an empty 201 response.
 */
export class ApiKeyRowMissingError extends Error {
  /** The identifier the insert attempted. */
  public readonly identifier: string;

  constructor(identifier: string) {
    super(
      `Insert into platform.api_keys returned no row for identifier ` +
        `"${identifier}".`,
    );
    this.name = 'ApiKeyRowMissingError';
    this.identifier = identifier;
  }
}
