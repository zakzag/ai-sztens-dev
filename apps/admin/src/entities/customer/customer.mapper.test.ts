import { describe, expect, it } from 'vitest';
import type { CustomerStatus } from '@callback/shared';
import {
  CUSTOMER_STATUS_VALUES,
  SECOND_CUSTOMER,
  VALID_CUSTOMER,
} from '@callback/shared';
import { formatDateTime } from '../../lib/date.js';
import {
  CUSTOMER_EMPTY_VALUE_LABEL,
  CUSTOMER_NO_PRIMARY_CONTACT_LABEL,
  CUSTOMER_TYPE_LABELS,
} from './customer.const.js';
import {
  toCustomerRowViewModel,
  toCustomerRowViewModels,
  toStatusVariant,
} from './customer.mapper.js';

/**
 * The `D10` mapping, spelled out **here** instead of being read back from the
 * constant: asserting the constant against itself would pass even if a status
 * silently moved into the wrong variant.
 */
const EXPECTED_BADGE_VARIANT: Readonly<Record<CustomerStatus, string>> = {
  prospect: 'neutral',
  registered: 'info',
  trial: 'info',
  active: 'success',
  suspended: 'warning',
  churned: 'danger',
  anonymized: 'neutral',
};

describe('toStatusVariant', () => {
  it.each(CUSTOMER_STATUS_VALUES)('maps %s onto its D10 badge variant', (status) => {
    expect(toStatusVariant(status)).toBe(EXPECTED_BADGE_VARIANT[status]);
  });
});

describe('toCustomerRowViewModel', () => {
  it('keeps the customer number and the resolved status label', () => {
    const row = toCustomerRowViewModel(VALID_CUSTOMER);

    expect(row.customerNumber).toBe(VALID_CUSTOMER.customerNumber);
    expect(row.status).toBe(VALID_CUSTOMER.status);
    expect(row.statusVariant).toBe('success');
    expect(row.id).toBe(VALID_CUSTOMER.id);
  });

  it('prefers the short name over the legal name', () => {
    const row = toCustomerRowViewModel(VALID_CUSTOMER);

    expect(row.displayName).toBe(VALID_CUSTOMER.shortName);
  });

  it('falls back to the legal name when there is no short name', () => {
    const row = toCustomerRowViewModel(SECOND_CUSTOMER);

    expect(SECOND_CUSTOMER.shortName).toBeNull();
    expect(row.displayName).toBe(SECOND_CUSTOMER.legalName);
  });

  it('translates the customer type through the label table', () => {
    const row = toCustomerRowViewModel(VALID_CUSTOMER);

    expect(row.typeLabel).toBe(CUSTOMER_TYPE_LABELS[VALID_CUSTOMER.type]);
  });

  it('renders a missing tax number as the empty-value placeholder', () => {
    const row = toCustomerRowViewModel(SECOND_CUSTOMER);

    expect(row.taxNumberText).toBe(CUSTOMER_EMPTY_VALUE_LABEL);
  });

  it('renders a missing primary contact as “Nincs”', () => {
    const row = toCustomerRowViewModel(SECOND_CUSTOMER);

    expect(row.primaryContactText).toBe(CUSTOMER_NO_PRIMARY_CONTACT_LABEL);
  });

  it('renders a missing last activity as the empty-value placeholder', () => {
    const row = toCustomerRowViewModel(SECOND_CUSTOMER);

    expect(row.lastActivityText).toBe(CUSTOMER_EMPTY_VALUE_LABEL);
  });

  it('formats a present last activity through lib/date', () => {
    const row = toCustomerRowViewModel(VALID_CUSTOMER);

    expect(VALID_CUSTOMER.lastActivityAt).not.toBeNull();
    expect(row.lastActivityText).toBe(
      formatDateTime(VALID_CUSTOMER.lastActivityAt ?? ''),
    );
  });

  it('passes the derived missing-data flag through untouched', () => {
    expect(toCustomerRowViewModel(VALID_CUSTOMER).hasMissingData).toBe(false);
    expect(toCustomerRowViewModel(SECOND_CUSTOMER).hasMissingData).toBe(true);
  });
});

describe('toCustomerRowViewModels', () => {
  it('maps every row and keeps the server order', () => {
    const rows = toCustomerRowViewModels([VALID_CUSTOMER, SECOND_CUSTOMER]);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe(VALID_CUSTOMER.id);
    expect(rows[1]?.id).toBe(SECOND_CUSTOMER.id);
  });

  it('maps an empty page to an empty list', () => {
    expect(toCustomerRowViewModels([])).toEqual([]);
  });
});
