import { describe, expect, it } from 'vitest';
import {
  CUSTOMERS_EMPTY_DESCRIPTION_FILTERED,
  CUSTOMERS_EMPTY_DESCRIPTION_UNFILTERED,
} from './customers.const.js';
import {
  toCustomerDetailRoute,
  toCustomerEditRoute,
  toCustomerSource,
  toCustomerStatus,
  toCustomerType,
  toEmptyStateDescription,
} from './customers.logic.js';

const CUSTOMER_ID = '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60';

describe('toCustomerDetailRoute', () => {
  it('fills the registry template with the id', () => {
    expect(toCustomerDetailRoute(CUSTOMER_ID)).toBe(`/customers/${CUSTOMER_ID}`);
  });

  it('encodes a segment that would otherwise break the path', () => {
    expect(toCustomerDetailRoute('a/b')).toBe('/customers/a%2Fb');
  });
});

describe('toCustomerEditRoute', () => {
  it('appends the edit segment to the detail route', () => {
    expect(toCustomerEditRoute(CUSTOMER_ID)).toBe(
      `/customers/${CUSTOMER_ID}/edit`,
    );
  });
});

describe('toCustomerType', () => {
  it('accepts a value the contract publishes', () => {
    expect(toCustomerType('sole_proprietor')).toBe('sole_proprietor');
  });

  it('reads the empty option as “no filter”', () => {
    expect(toCustomerType('')).toBeUndefined();
  });

  it('drops an unknown value instead of sending it', () => {
    expect(toCustomerType('partnership')).toBeUndefined();
  });
});

describe('toCustomerStatus', () => {
  it('accepts a value the contract publishes', () => {
    expect(toCustomerStatus('suspended')).toBe('suspended');
  });

  it('reads the empty option as “no filter”', () => {
    expect(toCustomerStatus('')).toBeUndefined();
  });

  it('drops an unknown value', () => {
    expect(toCustomerStatus('deleted')).toBeUndefined();
  });
});

describe('toCustomerSource', () => {
  it('accepts a value the contract publishes', () => {
    expect(toCustomerSource('referral')).toBe('referral');
  });

  it('reads the empty option as “no filter”', () => {
    expect(toCustomerSource('')).toBeUndefined();
  });

  it('drops an unknown value', () => {
    expect(toCustomerSource('billboard')).toBeUndefined();
  });
});

describe('toEmptyStateDescription', () => {
  it('invites the operator to create the first customer when nothing is filtered', () => {
    expect(toEmptyStateDescription(false)).toBe(
      CUSTOMERS_EMPTY_DESCRIPTION_UNFILTERED,
    );
  });

  it('blames the filters when the list is narrowed', () => {
    expect(toEmptyStateDescription(true)).toBe(
      CUSTOMERS_EMPTY_DESCRIPTION_FILTERED,
    );
  });
});
