/**
 * Domain errors of the customer-tags feature (AIS-178, slice e).
 *
 * Raised by the *repository* (the only layer that talks to Postgres) and handled
 * by the *service*. Free of `@nestjs/common` on purpose: the persistence layer
 * has to stay callable from a script or a worker, where "HTTP 409" means nothing.
 */

/**
 * Raised when `tags_name_key` rejected an insert of a **new** label.
 *
 * The service treats this as a lost race, not as a client error: the label it was
 * about to create already exists (created by a concurrent request), so the
 * correct answer is to re-read the row and reuse it (AIS-178/e `E7`).
 *
 * The collided label is exposed as {@link tagName} — `name` belongs to `Error`
 * and carries the class name in this codebase.
 */
export class TagNameRaceError extends Error {
  /** The label name that collided. */
  public readonly tagName: string;

  constructor(tagName: string, cause: unknown) {
    super(
      `The tag "${tagName}" was created by a concurrent request ` +
        '(unique constraint tags_name_key).',
      { cause },
    );
    this.name = 'TagNameRaceError';
    this.tagName = tagName;
  }
}

/**
 * Raised when `INSERT … RETURNING` reported success but returned no row.
 *
 * Expected to be impossible; failing loudly beats answering `201` with an empty
 * body.
 */
export class TagRowMissingError extends Error {
  /** The tag id the write addressed (`null` while inserting). */
  public readonly tagId: string | null;

  constructor(tagId: string | null) {
    super(`The write on customer.tags returned no row (id ${String(tagId)}).`);
    this.name = 'TagRowMissingError';
    this.tagId = tagId;
  }
}
