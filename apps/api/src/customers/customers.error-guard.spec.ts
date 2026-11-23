import {
  PostgresErrorMock,
  wrapDrizzleQueryError,
} from '../db/test/mocks/postgres-error.mock.js';
import {
  isCustomerNumberConflict,
  isCustomerTaxNumberConflict,
} from './customers.error-guard.js';

/**
 * Unit tests of the two `customers` constraint guards (AIS-178).
 *
 * The important half is the negative one: a `23505` from the **other**
 * constraint — or from a future one — must not be reported as this conflict,
 * because a fabricated `409` hides a real bug behind a business message.
 */

describe('isCustomerNumberConflict', () => {
  it('recognises the constraint through a Drizzle wrapper', () => {
    const error = wrapDrizzleQueryError(
      new PostgresErrorMock('23505', 'customers_customer_number_key'),
    );

    expect(isCustomerNumberConflict(error)).toBe(true);
  });

  it('rejects the tax number constraint', () => {
    const error = new PostgresErrorMock('23505', 'customers_tax_number_key');

    expect(isCustomerNumberConflict(error)).toBe(false);
  });

  it('rejects another SQLSTATE', () => {
    expect(
      isCustomerNumberConflict(
        new PostgresErrorMock('23503', 'customers_customer_number_key'),
      ),
    ).toBe(false);
  });

  it('rejects a non-object throwable', () => {
    expect(isCustomerNumberConflict('23505')).toBe(false);
  });
});

describe('isCustomerTaxNumberConflict', () => {
  it('recognises the partial unique index', () => {
    expect(
      isCustomerTaxNumberConflict(
        new PostgresErrorMock('23505', 'customers_tax_number_key'),
      ),
    ).toBe(true);
  });

  it('rejects the customer number constraint', () => {
    expect(
      isCustomerTaxNumberConflict(
        new PostgresErrorMock('23505', 'customers_customer_number_key'),
      ),
    ).toBe(false);
  });

  it('rejects a non-unique failure', () => {
    expect(isCustomerTaxNumberConflict(new PostgresErrorMock('23502'))).toBe(
      false,
    );
  });
});
