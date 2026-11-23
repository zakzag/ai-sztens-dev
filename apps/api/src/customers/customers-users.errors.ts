/**
 * Domain errors of the customer-user feature (AIS-178, slice e).
 *
 * Raised by the *repository* (the only layer that talks to Postgres) and
 * translated into `AppError`s by the *service*. Free of `@nestjs/common` on
 * purpose: the persistence layer has to stay callable from a script or a worker,
 * where "HTTP 409" means nothing.
 */

/**
 * Raised when `customer_users_email_key` rejected a write.
 *
 * The index is global and case-insensitive (`lower(email)`), so this means "this
 * address already holds a login somewhere", not "in this customer". The service
 * answers `409 CUSTOMER_USER_EMAIL_CONFLICT` on the `email` field.
 */
export class CustomerUserEmailConflictError extends Error {
  /** The address that was rejected. */
  public readonly email: string;

  constructor(email: string, cause: unknown) {
    super(
      `A customer user with the e-mail "${email}" already exists ` +
        '(unique index customer_users_email_key).',
      { cause },
    );
    this.name = 'CustomerUserEmailConflictError';
    this.email = email;
  }
}

/**
 * Raised when `customer_users_customer_owner_key` rejected a write.
 *
 * The index is partial (`customer_id WHERE role = 'owner' AND status = 'active'`),
 * so this means the update would create a **second active owner** — the service
 * answers `409 CUSTOMER_OWNER_CONFLICT` on the `role` field.
 */
export class CustomerOwnerConflictError extends Error {
  /** The customer whose owner slot is taken. */
  public readonly customerId: string;

  constructor(customerId: string, cause: unknown) {
    super(
      `Customer "${customerId}" already has an active owner ` +
        '(unique index customer_users_customer_owner_key).',
      { cause },
    );
    this.name = 'CustomerOwnerConflictError';
    this.customerId = customerId;
  }
}

/**
 * Raised when a foreign key still references the login user.
 *
 * `contacts_customer_user_id_fkey` / `activities_customer_user_id_fkey` are
 * `NO ACTION`: deleting the row would leave that history pointing nowhere. The
 * service answers `409 CUSTOMER_USER_IN_USE_CONFLICT`.
 */
export class CustomerUserInUseError extends Error {
  /** The user that is still referenced. */
  public readonly customerUserId: string;

  constructor(customerUserId: string, cause: unknown) {
    super(
      `Customer user "${customerUserId}" is still referenced by a contact or an ` +
        'activity, so it cannot be deleted.',
      { cause },
    );
    this.name = 'CustomerUserInUseError';
    this.customerUserId = customerUserId;
  }
}

/**
 * Raised when a write reported success but returned no row.
 *
 * Expected to be impossible; failing loudly beats answering `201` with an empty
 * body.
 */
export class CustomerUserRowMissingError extends Error {
  /** The user id the write addressed (`null` while inserting). */
  public readonly customerUserId: string | null;

  constructor(customerUserId: string | null) {
    super(
      `The write on iam.customer_users returned no row ` +
        `(id ${String(customerUserId)}).`,
    );
    this.name = 'CustomerUserRowMissingError';
    this.customerUserId = customerUserId;
  }
}
