/**
 * Fixtures of the customers list tests (AIS-19).
 *
 * Shared by the logic, hook and page tests so every one of them starts from the
 * same “empty URL” query — the schema defaults — instead of inventing its own
 * near-identical literal.
 */

import { CUSTOMER_DEFAULT_SORT } from '@callback/shared';
import type { CustomerListQuery, CustomerStatus } from '@callback/shared';
import { CUSTOMER_STATUS_BADGE_VARIANT, CUSTOMER_STATUS_LABELS } from '../../entities/customer/customer.const.js';
import type { CustomerRowViewModel } from '../../entities/customer/customer.interface.js';

/**
 * A parsed list query with the schema defaults, optionally overridden.
 *
 * @param patch - the fields a test wants to be different.
 * @returns a complete, valid {@link CustomerListQuery}.
 */
export function createCustomerListQuery(
  patch: Partial<CustomerListQuery> = {},
): CustomerListQuery {
  return {
    page: 1,
    limit: 20,
    order: 'asc',
    sort: CUSTOMER_DEFAULT_SORT,
    ...patch,
  };
}

/**
 * A mapped row with every field filled, optionally overridden.
 *
 * @param patch - the fields a test wants to be different.
 * @returns a complete {@link CustomerRowViewModel}.
 */
export function createCustomerRowViewModel(
  patch: Partial<CustomerRowViewModel> = {},
): CustomerRowViewModel {
  const status: CustomerStatus = patch.status ?? 'active';

  return {
    id: '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60',
    customerNumber: 'AIS-202611-001',
    displayName: 'Példa Kft.',
    typeLabel: 'Cég',
    taxNumberText: '10773381-2-44',
    status,
    statusLabel: CUSTOMER_STATUS_LABELS[status],
    statusVariant: CUSTOMER_STATUS_BADGE_VARIANT[status],
    primaryContactText: 'Nagy Anna',
    lastActivityText: '2026. 11. 17. 15:30',
    hasMissingData: false,
    ...patch,
  };
}
