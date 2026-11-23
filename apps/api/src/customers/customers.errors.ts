/**
 * Domain errors of the `customers` feature (AIS-178).
 *
 * They are raised by the *repository* (the only layer that talks to Postgres) or
 * by the *pure logic* (the number sequence), and translated into `AppError`s by
 * the *service*. Keeping them free of `@nestjs/common` is deliberate: the
 * persistence layer must stay usable from a migration script or a future worker,
 * where “HTTP 409” means nothing.
 */

/**
 * Raised when `customers_customer_number_key` rejected an insert.
 *
 * The service retries this **once** in a fresh transaction (plan `D6`): two
 * concurrent creates can read the same `max()` of the month, and the loser then
 * needs one more attempt with a number the winner has already committed.
 */
export class CustomerNumberConflictError extends Error {
  /** The number the insert attempted. */
  public readonly customerNumber: string;

  constructor(customerNumber: string, cause: unknown) {
    super(
      `Customer number "${customerNumber}" was allocated by a concurrent ` +
        'writer (unique constraint customers_customer_number_key).',
      { cause },
    );
    this.name = 'CustomerNumberConflictError';
    this.customerNumber = customerNumber;
  }
}

/**
 * Raised when `customers_tax_number_key` rejected an insert or an update.
 *
 * The index is partial (`deleted_at IS NULL`), so this error means “a **live**
 * customer already owns this tax number” — an archived one does not.
 */
export class CustomerTaxNumberConflictError extends Error {
  /** The tax number that already exists among live rows. */
  public readonly taxNumber: string;

  constructor(taxNumber: string, cause: unknown) {
    super(
      `Tax number "${taxNumber}" is already used by a live customer ` +
        '(unique index customers_tax_number_key).',
      { cause },
    );
    this.name = 'CustomerTaxNumberConflictError';
    this.taxNumber = taxNumber;
  }
}

/**
 * Raised when `INSERT … RETURNING` (or an update) reported success but returned
 * no row.
 *
 * Expected to be impossible; failing loudly beats returning `undefined` and
 * letting the caller answer `201` with an empty body.
 */
export class CustomerRowMissingError extends Error {
  /** The identifier the write attempted. */
  public readonly customerId: string | null;

  constructor(customerId: string | null) {
    super(
      `The write on customer.customers returned no row (id ${String(customerId)}).`,
    );
    this.name = 'CustomerRowMissingError';
    this.customerId = customerId;
  }
}

/**
 * Raised when the month's sequence cannot produce a next number.
 *
 * Two triggers, both a data-integrity signal rather than a user mistake:
 *
 * - the stored maximum does not end in a three-digit sequence (the column's
 *   `CHECK`/pattern makes that impossible, so it means hand-written data);
 * - the sequence already reached {@link CUSTOMER_NUMBER_SEQUENCE_MAX} and the
 *   format has to grow before another customer can be created this month.
 *
 * The service turns it into `409 CUSTOMER_NUMBER_CONFLICT`: the caller cannot
 * fix it by changing the payload, and the operator has to intervene.
 */
export class CustomerNumberExhaustedError extends Error {
  /** The month prefix the allocation was attempted for. */
  public readonly prefix: string;

  constructor(prefix: string, reason: string) {
    super(`Cannot allocate a customer number for "${prefix}": ${reason}`);
    this.name = 'CustomerNumberExhaustedError';
    this.prefix = prefix;
  }
}
