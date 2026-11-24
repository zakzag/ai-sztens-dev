/**
 * Domain errors of the customer-contacts feature (AIS-178, slice d).
 *
 * Raised by the *repository* (the only layer that talks to Postgres) and
 * translated into `AppError`s by the *service*. Free of `@nestjs/common` on
 * purpose: the persistence layer has to stay callable from a script or a worker,
 * where "HTTP 409" means nothing.
 */

/**
 * Raised when `contact_roles_primary_key` rejected a role insert.
 *
 * The index is partial (`customer_id WHERE role = 'primary'`), so this means "a
 * **live** contact of this customer already holds the `primary` role". The
 * service answers `409 CUSTOMER_PRIMARY_CONTACT_CONFLICT`.
 */
export class PrimaryContactConflictError extends Error {
  /** The contact that tried to take the flag. */
  public readonly contactId: string;

  constructor(contactId: string, cause: unknown) {
    super(
      `Contact "${contactId}" would be the second primary contact of its ` +
        'customer (unique index contact_roles_primary_key).',
      { cause },
    );
    this.name = 'PrimaryContactConflictError';
    this.contactId = contactId;
  }
}

/**
 * Raised when `contacts_customer_user_id_fkey` rejected a write.
 *
 * The composite key is `(customer_id, customer_user_id) → customer_users`, so the
 * only way to violate it is to point at a login user of **another** customer (or
 * at a user that does not exist). The payload is well formed, the content is not
 * → `422 SEMANTIC_VALIDATION_FAILED` on the `customerUserId` field.
 */
export class ContactUserMismatchError extends Error {
  /** The user id the payload referenced. */
  public readonly customerUserId: string;

  constructor(customerUserId: string, cause: unknown) {
    super(
      `Customer user "${customerUserId}" does not belong to this customer ` +
        '(foreign key contacts_customer_user_id_fkey).',
      { cause },
    );
    this.name = 'ContactUserMismatchError';
    this.customerUserId = customerUserId;
  }
}

/**
 * Raised when `INSERT … RETURNING` (or a guarded update) reported success but
 * returned no row.
 *
 * Expected to be impossible; failing loudly beats answering `201` with an empty
 * body.
 */
export class ContactRowMissingError extends Error {
  /** The contact id the write addressed (`null` while inserting). */
  public readonly contactId: string | null;

  constructor(contactId: string | null) {
    super(
      `The write on customer.contacts returned no row (id ${String(contactId)}).`,
    );
    this.name = 'ContactRowMissingError';
    this.contactId = contactId;
  }
}
