/**
 * Pure wire → view-model mapping of a customer (AIS-19).
 *
 * The mapper is where every formatting decision is made **once**:
 * - the display name (`shortName ?? legalName`), so a column cannot disagree
 *   with the detail page about what a customer is called;
 * - the three nullable fields (`taxNumber`, `primaryContactName`,
 *   `lastActivityAt`) rendered as their placeholder copy, so no cell needs a
 *   conditional;
 * - the status → badge verdict (`D10`), so a second mapping cannot appear.
 *
 * No JSX, no hook, no I/O: the whole file is testable with plain values.
 */

import type { Customer, CustomerStatus } from '@callback/shared';
import { formatDateTime } from '../../lib/date.js';
import {
  CUSTOMER_EMPTY_VALUE_LABEL,
  CUSTOMER_NO_PRIMARY_CONTACT_LABEL,
  CUSTOMER_STATUS_BADGE_VARIANT,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
} from './customer.const.js';
import type {
  BadgeVariant,
  CustomerRowViewModel,
  CustomerRowViewModels,
} from './customer.interface.js';

/**
 * @param status - the domain status from the wire.
 * @returns the badge variant the `D10` table assigns to it.
 */
export function toStatusVariant(status: CustomerStatus): BadgeVariant {
  return CUSTOMER_STATUS_BADGE_VARIANT[status];
}

/**
 * The single place that decides what a customer is called.
 *
 * `shortName` is nullable because not every legal name has a trading name; an
 * empty string is treated as absent, because a name of one space would
 * otherwise render as a blank cell.
 *
 * @param dto - one row of `GET /api/admin/customers`.
 * @returns the trading name, or the legal name as the fallback.
 */
function toDisplayName(dto: Customer): string {
  const shortName = dto.shortName?.trim() ?? '';

  return shortName.length > 0 ? shortName : dto.legalName;
}

/**
 * @param dto - one row of `GET /api/admin/customers`.
 * @returns the renderable row; nothing raw or nullable survives.
 */
export function toCustomerRowViewModel(dto: Customer): CustomerRowViewModel {
  return {
    id: dto.id,
    customerNumber: dto.customerNumber,
    displayName: toDisplayName(dto),
    typeLabel: CUSTOMER_TYPE_LABELS[dto.type],
    taxNumberText: dto.taxNumber ?? CUSTOMER_EMPTY_VALUE_LABEL,
    status: dto.status,
    statusLabel: CUSTOMER_STATUS_LABELS[dto.status],
    statusVariant: toStatusVariant(dto.status),
    primaryContactText:
      dto.primaryContactName ?? CUSTOMER_NO_PRIMARY_CONTACT_LABEL,
    lastActivityText:
      dto.lastActivityAt === null
        ? CUSTOMER_EMPTY_VALUE_LABEL
        : formatDateTime(dto.lastActivityAt),
    hasMissingData: dto.hasMissingData,
  };
}

/**
 * @param dtos - the page returned by `GET /api/admin/customers`.
 * @returns the same order, mapped row by row.
 */
export function toCustomerRowViewModels(
  dtos: readonly Customer[],
): CustomerRowViewModels {
  return dtos.map(toCustomerRowViewModel);
}
