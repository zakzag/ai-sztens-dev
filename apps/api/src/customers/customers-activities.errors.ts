/**
 * Domain errors of the customer-activities feature (AIS-178, slice f).
 *
 * No Nest, no HTTP status and no `AppError`: the service turns these into
 * `AppError`s (a `409`/`404` **decision**), and a spec can assert on them without
 * a Nest testing module. An error that the service does *not* translate stays a
 * `500`, which is the correct answer for a wiring bug.
 */

import type { AuthorType } from '@callback/shared';

/**
 * `INSERT … RETURNING` produced no row.
 *
 * Not a client error: Postgres always returns the inserted row, so an empty
 * answer means the statement was built against the wrong table — it must fail
 * loudly instead of becoming an `undefined` payload.
 */
export class ActivityRowMissingError extends Error {
  /**
   * @param activityId - the id the write expected, when it is already known.
   */
  constructor(activityId: string | null) {
    super(
      activityId === null
        ? 'The activity insert returned no row.'
        : `The activity "${activityId}" disappeared between the write and the read.`,
    );
    this.name = 'ActivityRowMissingError';
  }
}

/**
 * An `AuditActor` that cannot satisfy `activities_author_reference_check`.
 *
 * `author_type = 'operator'` requires `operator_id`, and
 * `author_type = 'customer_user'` requires `customer_user_id`; an actor of one
 * of those types without an id would be rejected by the database check. Catching
 * it here names the wiring problem instead of surfacing a constraint violation
 * as a `500` with a Postgres message.
 */
export class ActivityAuthorIncompleteError extends Error {
  /**
   * @param authorType - the actor type that arrived without its id.
   */
  constructor(authorType: AuthorType) {
    super(
      `The audit actor provider returned authorType "${authorType}" without an id, ` +
        'so no author reference could be written.',
    );
    this.name = 'ActivityAuthorIncompleteError';
  }
}
