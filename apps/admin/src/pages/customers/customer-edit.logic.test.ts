/**
 * Tests of the customer edit surface's pure rules (AIS-21).
 *
 * No React, no network: the schema, the value mapping, the payload builder and the
 * country list are all values in, values out — which is why every branch below is
 * asserted directly instead of through the form.
 */

import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_STATUS_VALUES,
  VALID_CUSTOMER_DETAIL,
  type CustomerStatus,
} from '@callback/shared';
import { CUSTOMER_DETAIL_FIELD_LABELS } from '../../entities/customer/customer.const.js';
import { CUSTOMER_UPDATE_FIELD_PATHS } from '../../features/customers/customers.const.js';
import {
  CUSTOMER_COUNTRY_OPTIONS,
  CUSTOMER_EDIT_HEADCOUNT_OPTIONS,
  CUSTOMER_EDIT_SOURCE_OPTIONS,
} from './customers.const.js';
import {
  customerEditFormSchema,
  customerStatusFormSchema,
  toCountryOptions,
  toCustomerEditValues,
  toReadOnlyItems,
  toUpdateCustomerPayload,
} from './customer-edit.logic.js';

/** The version the form was seeded from in every test below. */
const UPDATED_AT = '2026-11-20T09:00:00.000Z';

/** Form values of the shared fixture — the only “happy path” object these tests need. */
const VALUES = toCustomerEditValues(VALID_CUSTOMER_DETAIL);

describe('customerEditFormSchema', () => {
  it('accepts the record the form was seeded from', () => {
    expect(customerEditFormSchema.safeParse(VALUES).success).toBe(true);
  });

  it('accepts empty optional format fields', () => {
    // “Clear it” is a real intent: an emptied tax number or postal code must not
    // be a validation failure, otherwise a value could never be removed.
    const result = customerEditFormSchema.safeParse({
      ...VALUES,
      taxNumber: '',
      registeredAddressZip: '',
      headcountRange: '',
      source: '',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a malformed tax number', () => {
    const result = customerEditFormSchema.safeParse({
      ...VALUES,
      taxNumber: 'not-a-tax-number',
    });

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues[0]?.path).toEqual([
      'taxNumber',
    ]);
  });

  it('rejects a malformed postal code', () => {
    const result = customerEditFormSchema.safeParse({
      ...VALUES,
      registeredAddressZip: '12',
    });

    expect(result.success).toBe(false);
  });

  it('requires the three fields the contract always has', () => {
    expect(
      customerEditFormSchema.safeParse({ ...VALUES, legalName: '  ' }).success,
    ).toBe(false);
    expect(
      customerEditFormSchema.safeParse({ ...VALUES, type: '' }).success,
    ).toBe(false);
    expect(
      customerEditFormSchema.safeParse({
        ...VALUES,
        registeredAddressCountry: 'hungary',
      }).success,
    ).toBe(false);
  });

  it('rejects a server-managed key', () => {
    // The request schema is `.strict()`, and the form must not be able to smuggle
    // the status into the field PATCH — that is what `PATCH /:id/status` is for.
    const result = customerEditFormSchema.safeParse({
      ...VALUES,
      status: 'active',
    });

    expect(result.success).toBe(false);
  });
});

describe('customerStatusFormSchema', () => {
  it('accepts every contract status', () => {
    for (const status of CUSTOMER_STATUS_VALUES) {
      expect(customerStatusFormSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it('rejects a value outside the contract', () => {
    expect(
      customerStatusFormSchema.safeParse({ status: 'archived' }).success,
    ).toBe(false);
  });

  it('does not let the concurrency token travel as an input', () => {
    expect(
      customerStatusFormSchema.safeParse({ status: 'active', updatedAt: UPDATED_AT })
        .success,
    ).toBe(false);
  });
});

describe('toCustomerEditValues', () => {
  it('renders every null as the empty string', () => {
    const values = toCustomerEditValues({
      ...VALID_CUSTOMER_DETAIL,
      shortName: null,
      taxNumber: null,
      euVatNumber: null,
      companyRegistrationNumber: null,
      legalForm: null,
      registeredAddressZip: null,
      registeredAddressCity: null,
      registeredAddressLine: null,
      industry: null,
      headcountRange: null,
      source: null,
    });

    expect(values.shortName).toBe('');
    expect(values.taxNumber).toBe('');
    expect(values.euVatNumber).toBe('');
    expect(values.companyRegistrationNumber).toBe('');
    expect(values.legalForm).toBe('');
    expect(values.registeredAddressZip).toBe('');
    expect(values.registeredAddressCity).toBe('');
    expect(values.registeredAddressLine).toBe('');
    expect(values.industry).toBe('');
    expect(values.headcountRange).toBe('');
    expect(values.source).toBe('');
    expect(values.type).toBe(VALID_CUSTOMER_DETAIL.type);
    expect(values.legalName).toBe(VALID_CUSTOMER_DETAIL.legalName);
  });
});

describe('toUpdateCustomerPayload', () => {
  it('always carries the concurrency token and no server-managed key', () => {
    const payload = toUpdateCustomerPayload(VALUES, UPDATED_AT);

    expect(payload.updatedAt).toBe(UPDATED_AT);
    expect(Object.keys(payload).sort()).toEqual(
      [...CUSTOMER_UPDATE_FIELD_PATHS, 'updatedAt'].sort(),
    );
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('customerNumber');
    expect(payload).not.toHaveProperty('id');
  });

  it('sends an emptied optional text as an explicit null', () => {
    const payload = toUpdateCustomerPayload(
      { ...VALUES, taxNumber: '   ', shortName: '' },
      UPDATED_AT,
    );

    expect(payload.taxNumber).toBeNull();
    expect(payload.shortName).toBeNull();
  });

  it('trims the values it sends', () => {
    const payload = toUpdateCustomerPayload(
      { ...VALUES, legalName: '  Példa Kft.  ', registeredAddressCity: ' Budapest ' },
      UPDATED_AT,
    );

    expect(payload.legalName).toBe('Példa Kft.');
    expect(payload.registeredAddressCity).toBe('Budapest');
  });

  it('maps an emptied select to null', () => {
    const payload = toUpdateCustomerPayload(
      { ...VALUES, headcountRange: '', source: '' },
      UPDATED_AT,
    );

    expect(payload.headcountRange).toBeNull();
    expect(payload.source).toBeNull();
  });

  it('narrows the selects onto the contract values', () => {
    const payload = toUpdateCustomerPayload(
      { ...VALUES, type: 'sole_proprietor', headcountRange: '2_5', source: 'referral' },
      UPDATED_AT,
    );

    expect(payload.type).toBe('sole_proprietor');
    expect(payload.headcountRange).toBe('2_5');
    expect(payload.source).toBe('referral');
  });

  it('throws on a type the contract does not know', () => {
    expect(() =>
      toUpdateCustomerPayload({ ...VALUES, type: 'partnership' }, UPDATED_AT),
    ).toThrow(RangeError);
  });
});

describe('toCountryOptions', () => {
  it('returns the fixed list for a listed country', () => {
    expect(toCountryOptions('HU')).toBe(CUSTOMER_COUNTRY_OPTIONS);
  });

  it('appends a value the list does not contain', () => {
    const options = toCountryOptions('jp');

    expect(options).toHaveLength(CUSTOMER_COUNTRY_OPTIONS.length + 1);
    expect(options[options.length - 1]).toEqual({ value: 'JP', label: 'JP' });
  });

  it('returns the fixed list when the record has no country at all', () => {
    expect(toCountryOptions('  ')).toBe(CUSTOMER_COUNTRY_OPTIONS);
  });
});

describe('toReadOnlyItems', () => {
  it('lists the three read-only identifiers with the entity labels', () => {
    const items = toReadOnlyItems(VALID_CUSTOMER_DETAIL);

    expect(items.map((item) => item.label)).toEqual([
      CUSTOMER_DETAIL_FIELD_LABELS.customerNumber,
      CUSTOMER_DETAIL_FIELD_LABELS.createdAt,
      CUSTOMER_DETAIL_FIELD_LABELS.updatedAt,
    ]);
    expect(items[0]?.value).toBe(VALID_CUSTOMER_DETAIL.customerNumber);
    // A timestamp reaches the UI formatted, never as the raw ISO string.
    expect(items[1]?.value).not.toBe(VALID_CUSTOMER_DETAIL.createdAt);
  });
});

describe('select option tables', () => {
  it('offers a clearable empty entry on both optional selects', () => {
    expect(CUSTOMER_EDIT_HEADCOUNT_OPTIONS[0]?.value).toBe('');
    expect(CUSTOMER_EDIT_SOURCE_OPTIONS[0]?.value).toBe('');
  });
});

describe('status values', () => {
  it('covers the closed status set exactly once', () => {
    const statuses: readonly CustomerStatus[] = CUSTOMER_STATUS_VALUES;

    expect(new Set(statuses).size).toBe(statuses.length);
  });
});
