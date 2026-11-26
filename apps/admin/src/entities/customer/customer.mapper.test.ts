import { describe, expect, it } from 'vitest';
import type { CustomerDetail, CustomerStatus } from '@callback/shared';
import {
  CUSTOMER_STATUS_VALUES,
  SECOND_CUSTOMER,
  VALID_CUSTOMER,
  VALID_CUSTOMER_DETAIL,
} from '@callback/shared';
import { formatDateTime } from '../../lib/date.js';
import {
  CUSTOMER_DETAIL_FIELD_LABELS,
  CUSTOMER_DETAIL_GROUP_TITLES,
  CUSTOMER_DETAIL_OVERVIEW_LABELS,
  CUSTOMER_EMPTY_VALUE_LABEL,
  CUSTOMER_HEADCOUNT_RANGE_LABELS,
  CUSTOMER_NO_PRIMARY_CONTACT_LABEL,
  CUSTOMER_SOURCE_LABELS,
  CUSTOMER_TYPE_LABELS,
} from './customer.const.js';
import {
  toCustomerDetailViewModel,
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

/** The fully filled customer's detail payload, as the page receives it. */
const FULL_DETAIL: CustomerDetail = VALID_CUSTOMER_DETAIL;

/** The other branch: a detail whose optional fields are all `null`. */
const MISSING_DETAIL: CustomerDetail = {
  ...SECOND_CUSTOMER,
  tags: [],
  contacts: [],
  customerUsers: [],
};

describe('toCustomerDetailViewModel', () => {
  it('resolves the header from the same display-name rule as the list', () => {
    const model = toCustomerDetailViewModel(FULL_DETAIL);

    expect(model.displayName).toBe(VALID_CUSTOMER.shortName);
    expect(model.customerNumber).toBe(VALID_CUSTOMER.customerNumber);
    expect(model.status).toBe(VALID_CUSTOMER.status);
  });

  it('falls back to the legal name and keeps the missing-data flag', () => {
    const model = toCustomerDetailViewModel(MISSING_DETAIL);

    expect(model.displayName).toBe(SECOND_CUSTOMER.legalName);
    expect(model.hasMissingData).toBe(true);
  });

  it('builds the overview without the status row', () => {
    const model = toCustomerDetailViewModel(FULL_DETAIL);

    expect(model.overview.map((item) => item.label)).toEqual([
      CUSTOMER_DETAIL_OVERVIEW_LABELS.statusChangedAt,
      CUSTOMER_DETAIL_OVERVIEW_LABELS.primaryContact,
      CUSTOMER_DETAIL_FIELD_LABELS.lastActivity,
    ]);
    expect(model.overview[0]?.value).toBe(
      formatDateTime(VALID_CUSTOMER.statusChangedAt),
    );
    expect(model.overview[1]?.value).toBe(VALID_CUSTOMER.primaryContactName);
    expect(model.overview[2]?.value).toBe(
      formatDateTime(VALID_CUSTOMER.lastActivityAt ?? ''),
    );
  });

  it('renders the absent primary contact and last activity as placeholders', () => {
    const model = toCustomerDetailViewModel(MISSING_DETAIL);

    expect(model.overview[1]?.value).toBe(CUSTOMER_NO_PRIMARY_CONTACT_LABEL);
    expect(model.overview[2]?.value).toBe(CUSTOMER_EMPTY_VALUE_LABEL);
  });

  it('returns the four groups in the contract order', () => {
    const model = toCustomerDetailViewModel(FULL_DETAIL);

    expect(model.groups.map((group) => group.title)).toEqual([
      CUSTOMER_DETAIL_GROUP_TITLES.identifiers,
      CUSTOMER_DETAIL_GROUP_TITLES.legal,
      CUSTOMER_DETAIL_GROUP_TITLES.address,
      CUSTOMER_DETAIL_GROUP_TITLES.other,
    ]);
  });

  it('translates type, source and headcount through the label tables', () => {
    const [identifiers, , , other] = toCustomerDetailViewModel(FULL_DETAIL).groups;

    expect(identifiers?.items[0]?.value).toBe(VALID_CUSTOMER.customerNumber);
    expect(identifiers?.items[1]?.value).toBe(
      CUSTOMER_TYPE_LABELS[VALID_CUSTOMER.type],
    );
    expect(identifiers?.items[2]?.value).toBe(
      CUSTOMER_SOURCE_LABELS[VALID_CUSTOMER.source ?? 'manual'],
    );
    expect(other?.items[1]?.value).toBe(
      CUSTOMER_HEADCOUNT_RANGE_LABELS[VALID_CUSTOMER.headcountRange ?? 'sole'],
    );
  });

  it('formats every timestamp instead of rendering raw ISO', () => {
    const [identifiers] = toCustomerDetailViewModel(FULL_DETAIL).groups;
    const values = identifiers?.items.map((item) => item.value) ?? [];

    expect(values).toContain(formatDateTime(VALID_CUSTOMER.createdAt));
    expect(values).toContain(formatDateTime(VALID_CUSTOMER.updatedAt));
    expect(values).not.toContain(VALID_CUSTOMER.createdAt);
  });

  it('renders the missing legal, address and other fields as placeholders', () => {
    const [, legal, address, other] = toCustomerDetailViewModel(MISSING_DETAIL).groups;

    expect(legal?.items[1]?.value).toBe(CUSTOMER_EMPTY_VALUE_LABEL);
    expect(legal?.items[2]?.value).toBe(CUSTOMER_EMPTY_VALUE_LABEL);
    expect(address?.items[0]?.value).toBe(CUSTOMER_EMPTY_VALUE_LABEL);
    expect(address?.items[1]?.value).toBe(CUSTOMER_EMPTY_VALUE_LABEL);
    expect(other?.items[0]?.value).toBe(CUSTOMER_EMPTY_VALUE_LABEL);
    // The country is never null in the contract, so it is always shown.
    expect(address?.items[3]?.value).toBe(SECOND_CUSTOMER.registeredAddressCountry);
  });

  it('treats a blank optional text as absent', () => {
    const model = toCustomerDetailViewModel({
      ...FULL_DETAIL,
      shortName: '   ',
      industry: '  ',
    });

    expect(model.displayName).toBe(FULL_DETAIL.legalName);
    expect(model.groups[3]?.items[0]?.value).toBe(CUSTOMER_EMPTY_VALUE_LABEL);
  });
});
