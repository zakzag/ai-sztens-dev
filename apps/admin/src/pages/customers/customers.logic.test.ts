import { describe, expect, it } from 'vitest';
import { API_ERROR_CODE } from '@callback/shared';
import { createCodedError } from '../../test/mocks/api-error.mock.js';
import {
  CUSTOMERS_EMPTY_DESCRIPTION_FILTERED,
  CUSTOMERS_EMPTY_DESCRIPTION_UNFILTERED,
} from './customers.const.js';
import {
  toCustomerDetailRoute,
  toCustomerDetailState,
  toCustomerEditRoute,
  toCustomerSource,
  toCustomerStatus,
  toCustomerType,
  toEmptyStateDescription,
} from './customers.logic.js';

const CUSTOMER_ID = '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60';

describe('toCustomerDetailState', () => {
  /** The success shape: a payload, no failure, no request in flight. */
  const SUCCESS = {
    isLoading: false,
    error: null,
    errorSurface: null,
    hasData: true,
  } as const;

  it('is success when the payload arrived', () => {
    expect(toCustomerDetailState(SUCCESS)).toBe('success');
  });

  it('is loading while the read is in flight, even over a stale failure', () => {
    expect(
      toCustomerDetailState({
        ...SUCCESS,
        isLoading: true,
        hasData: false,
        errorSurface: 'page',
        error: createCodedError({ status: 500, code: null }),
      }),
    ).toBe('loading');
  });

  it('treats a cancelled request as loading, not as a failure', () => {
    expect(
      toCustomerDetailState({
        ...SUCCESS,
        hasData: false,
        errorSurface: 'silent',
      }),
    ).toBe('loading');
  });

  it('gives a 404 its own state', () => {
    expect(
      toCustomerDetailState({
        ...SUCCESS,
        hasData: false,
        errorSurface: 'page',
        error: createCodedError({
          status: 404,
          code: API_ERROR_CODE.NOT_FOUND,
        }),
      }),
    ).toBe('not-found');
  });

  it('renders any other page-tier failure as the page error', () => {
    expect(
      toCustomerDetailState({
        ...SUCCESS,
        hasData: false,
        errorSurface: 'page',
        error: createCodedError({ status: 500, code: null }),
      }),
    ).toBe('error');
  });

  it('leaves a banner-tier failure to the layout banner', () => {
    expect(
      toCustomerDetailState({
        ...SUCCESS,
        hasData: false,
        errorSurface: 'banner',
        error: createCodedError({ status: 503, code: null }),
      }),
    ).toBe('unavailable');
  });

  it('treats a URL without an id as not found', () => {
    expect(
      toCustomerDetailState({ ...SUCCESS, hasData: false }),
    ).toBe('not-found');
  });
});

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
