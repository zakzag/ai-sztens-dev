import { describe, expect, it } from 'vitest';
import { CUSTOMER_DEFAULT_SORT } from '@callback/shared';
import { createCustomerListQuery } from '../../test/mocks/customer-list-query.mock.js';
import {
  hasActiveFilters,
  isCustomerSortable,
  toCustomerSortField,
  toSortParams,
  toTableSort,
} from './customers.logic.js';

describe('isCustomerSortable', () => {
  it.each(['customerNumber', 'legalName', 'shortName', 'status', 'createdAt'])(
    'accepts %s, which the contract publishes',
    (columnId) => {
      expect(isCustomerSortable(columnId)).toBe(true);
    },
  );

  it.each(['taxNumber', 'primaryContact', 'hasMissingData', 'nonsense'])(
    'rejects %s, which the contract does not publish',
    (columnId) => {
      expect(isCustomerSortable(columnId)).toBe(false);
    },
  );
});

describe('toCustomerSortField', () => {
  it('keeps a column the contract accepts', () => {
    expect(toCustomerSortField('status')).toBe('status');
  });

  it('falls back to the contract default for an unknown column', () => {
    // The server answers an unknown `?sort=` with a 400, so the URL must never
    // carry one — not even if a table column id drifts.
    expect(toCustomerSortField('taxNumber')).toBe(CUSTOMER_DEFAULT_SORT);
  });
});

describe('toTableSort', () => {
  it('reports the query the URL carries', () => {
    const params = createCustomerListQuery({
      sort: 'lastActivityAt',
      order: 'desc',
    });

    expect(toTableSort(params)).toEqual({
      columnId: 'lastActivityAt',
      order: 'desc',
    });
  });
});

describe('toSortParams', () => {
  it('returns only the two fields a sort changes', () => {
    // The page resets the page number through `setParams`; adding `page` here
    // would state the same rule twice (AIS-116 D4).
    expect(toSortParams({ columnId: 'status', order: 'desc' })).toEqual({
      sort: 'status',
      order: 'desc',
    });
  });

  it('narrows an unsortable column before it reaches the URL', () => {
    expect(
      toSortParams({ columnId: 'hasMissingData', order: 'asc' }).sort,
    ).toBe(CUSTOMER_DEFAULT_SORT);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the schema defaults', () => {
    expect(hasActiveFilters(createCustomerListQuery())).toBe(false);
  });

  it('ignores an empty search term', () => {
    expect(hasActiveFilters(createCustomerListQuery({ q: '' }))).toBe(false);
  });

  it.each([
    { q: 'példa' },
    { type: 'company' as const },
    { status: 'suspended' as const },
    { source: 'referral' as const },
  ])('is true when %o is set', (patch) => {
    expect(hasActiveFilters(createCustomerListQuery(patch))).toBe(true);
  });

  it('is true when several filters are set together', () => {
    const params = createCustomerListQuery({
      q: 'kiss',
      type: 'sole_proprietor',
      status: 'prospect',
      source: 'website',
    });

    expect(hasActiveFilters(params)).toBe(true);
  });
});
