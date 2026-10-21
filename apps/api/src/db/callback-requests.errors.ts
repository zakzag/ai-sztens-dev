/**
 * Errors raised by the callback-request persistence layer.
 *
 * They are deliberately framework-agnostic: the `db` layer knows nothing about
 * HTTP, so it never throws a NestJS `NotFoundException`. Translating these into
 * HTTP responses is the service layer's job (AIS-38), which keeps the
 * repository reusable from workers and CLI jobs as well.
 *
 * Each error carries the offending value as a readonly field, so a caller can
 * build a precise message or a structured log line without re-parsing the text.
 */

/**
 * Thrown when `findOne` finds no row for an otherwise valid id.
 *
 * Not a "not found" response on purpose — "the row does not exist" and "the
 * caller is not allowed to see it" must stay distinguishable at the HTTP layer.
 */
export class CallbackRequestNotFoundError extends Error {
  public readonly id: string;

  constructor(id: string) {
    super(`Callback request ${id} not found`);
    this.name = 'CallbackRequestNotFoundError';
    this.id = id;
  }
}

/**
 * Thrown when an id cannot possibly identify a row, so no query is issued.
 *
 * Guards the database from a pointless round-trip and the logs from a raw
 * Postgres `22P02 invalid input syntax for type uuid`. Only the canonical dashed
 * RFC 4122 form (`8-4-4-4-12`) is accepted, because that is the only shape the
 * API ever generates or receives in a path parameter.
 */
export class InvalidCallbackRequestIdError extends Error {
  public readonly value: string;

  constructor(value: string) {
    super(`Invalid callback request id: "${value}"`);
    this.name = 'InvalidCallbackRequestIdError';
    this.value = value;
  }
}

/**
 * Thrown when an `INSERT … RETURNING` comes back without a row.
 *
 * Postgres cannot do that for a plain insert, so reaching this state means the
 * SQL was rewritten (a trigger, a rule or an `ON CONFLICT DO NOTHING` added
 * later). Failing loudly beats returning `undefined` and letting a caller
 * serialise `null` to the client.
 */
export class CallbackRequestNotPersistedError extends Error {
  constructor() {
    super('Callback request insert returned no row');
    this.name = 'CallbackRequestNotPersistedError';
  }
}
