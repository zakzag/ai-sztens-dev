import {
  PG_FOREIGN_KEY_VIOLATION_CODE,
  PG_UNIQUE_VIOLATION_CODE,
} from '../db/postgres-error.logic.js';
import {
  isContactUserMismatch,
  isPrimaryContactConflict,
} from './customers-contacts.error-guard.js';
import {
  CONTACT_PRIMARY_ROLE_CONSTRAINT,
  CONTACT_USER_FK_CONSTRAINT,
} from './customers-contacts.const.js';

/**
 * Unit tests of the two contact guards (AIS-178, slice d).
 *
 * Both are "is this **that** constraint?" decisions, so the suite proves the two
 * failure modes a false positive would cause: a tax-number conflict reported as a
 * primary-contact conflict (or the other way round), and a violation of a
 * *different* constraint of the same table being swallowed as a business answer.
 */

/**
 * @param code - SQLSTATE to report.
 * @param constraint - the constraint/index name to report.
 * @returns a value shaped like the driver error Drizzle wraps.
 */
function driverError(code: string, constraint?: string): unknown {
  return {
    code,
    ...(constraint === undefined ? {} : { constraint_name: constraint }),
  };
}

describe('isPrimaryContactConflict', () => {
  it('matches a 23505 on the partial primary index', () => {
    expect(
      isPrimaryContactConflict(
        driverError(PG_UNIQUE_VIOLATION_CODE, CONTACT_PRIMARY_ROLE_CONSTRAINT),
      ),
    ).toBe(true);
  });

  it('accepts the `constraint` spelling too', () => {
    expect(
      isPrimaryContactConflict({
        code: PG_UNIQUE_VIOLATION_CODE,
        constraint: CONTACT_PRIMARY_ROLE_CONSTRAINT,
      }),
    ).toBe(true);
  });

  it('walks the cause chain of a wrapped error', () => {
    const wrapped = new Error('query failed', {
      cause: driverError(
        PG_UNIQUE_VIOLATION_CODE,
        CONTACT_PRIMARY_ROLE_CONSTRAINT,
      ),
    });

    expect(isPrimaryContactConflict(wrapped)).toBe(true);
  });

  it('rejects a 23505 on another constraint', () => {
    expect(
      isPrimaryContactConflict(
        driverError(PG_UNIQUE_VIOLATION_CODE, 'customers_tax_number_key'),
      ),
    ).toBe(false);
  });

  it('rejects a foreign-key violation', () => {
    expect(
      isPrimaryContactConflict(
        driverError(
          PG_FOREIGN_KEY_VIOLATION_CODE,
          CONTACT_PRIMARY_ROLE_CONSTRAINT,
        ),
      ),
    ).toBe(false);
  });

  it('rejects a non-error value', () => {
    expect(isPrimaryContactConflict('23505')).toBe(false);
    expect(isPrimaryContactConflict(null)).toBe(false);
  });
});

describe('isContactUserMismatch', () => {
  it('matches a 23503 on the composite user key', () => {
    expect(
      isContactUserMismatch(
        driverError(PG_FOREIGN_KEY_VIOLATION_CODE, CONTACT_USER_FK_CONSTRAINT),
      ),
    ).toBe(true);
  });

  it('rejects a 23503 on the customer key', () => {
    expect(
      isContactUserMismatch(
        driverError(
          PG_FOREIGN_KEY_VIOLATION_CODE,
          'contacts_customer_id_customers_id_fk',
        ),
      ),
    ).toBe(false);
  });

  it('rejects a unique violation', () => {
    expect(
      isContactUserMismatch(
        driverError(PG_UNIQUE_VIOLATION_CODE, CONTACT_PRIMARY_ROLE_CONSTRAINT),
      ),
    ).toBe(false);
  });
});
