/**
 * Pure wire → view-model mapping of a customer (AIS-19, extended by AIS-20).
 *
 * The mapper is where every formatting decision is made **once**:
 * - the display name (`shortName ?? legalName`), so a column cannot disagree
 *   with the detail page about what a customer is called;
 * - the three nullable fields (`taxNumber`, `primaryContactName`,
 *   `lastActivityAt`) rendered as their placeholder copy, so no cell needs a
 *   conditional;
 * - the status → badge verdict (`D10`), so a second mapping cannot appear;
 * - the detail page's four `data` groups and its `overview` pairs (AIS-20), so
 *   no `DescriptionList` is assembled inside JSX.
 *
 * No JSX, no hook, no I/O: the whole file is testable with plain values. That is
 * also why the detail view model carries the status as a **machine value**: a
 * badge is a React node, and the overview component renders it.
 */

import type { Customer, CustomerDetail, CustomerStatus } from '@callback/shared';
import { formatDateTime } from '../../lib/date.js';
import {
  CUSTOMER_DETAIL_FIELD_LABELS,
  CUSTOMER_DETAIL_GROUP_TITLES,
  CUSTOMER_DETAIL_OVERVIEW_LABELS,
  CUSTOMER_EMPTY_VALUE_LABEL,
  CUSTOMER_HEADCOUNT_RANGE_LABELS,
  CUSTOMER_NO_PRIMARY_CONTACT_LABEL,
  CUSTOMER_SOURCE_LABELS,
  CUSTOMER_STATUS_BADGE_VARIANT,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
} from './customer.const.js';
import type {
  BadgeVariant,
  CustomerDetailGroup,
  CustomerDetailViewModel,
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

/**
 * Renders a nullable wire text as the final string a description list shows.
 *
 * A blank string is treated as absent for the same reason `toDisplayName` does:
 * a name of one space would otherwise render as an empty `dd`, which reads like a
 * broken layout instead of missing data.
 *
 * @param value - the nullable wire value.
 * @returns the trimmed value, or {@link CUSTOMER_EMPTY_VALUE_LABEL}.
 */
function toOptionalText(value: string | null): string {
  const trimmed = value?.trim() ?? '';

  return trimmed.length > 0 ? trimmed : CUSTOMER_EMPTY_VALUE_LABEL;
}

/**
 * @param iso - a nullable ISO 8601 instant.
 * @returns the local date and time, or {@link CUSTOMER_EMPTY_VALUE_LABEL}.
 */
function toOptionalDateTimeText(iso: string | null): string {
  return iso === null ? CUSTOMER_EMPTY_VALUE_LABEL : formatDateTime(iso);
}

/**
 * @param dto - the detail payload.
 * @returns the “Azonosítók” group: generated id, type, source and the audit stamps.
 */
function toIdentifiersGroup(dto: CustomerDetail): CustomerDetailGroup {
  return {
    title: CUSTOMER_DETAIL_GROUP_TITLES.identifiers,
    items: [
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.customerNumber,
        value: dto.customerNumber,
      },
      { label: CUSTOMER_DETAIL_FIELD_LABELS.type, value: CUSTOMER_TYPE_LABELS[dto.type] },
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.source,
        value:
          dto.source === null
            ? CUSTOMER_EMPTY_VALUE_LABEL
            : CUSTOMER_SOURCE_LABELS[dto.source],
      },
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.createdAt,
        value: formatDateTime(dto.createdAt),
      },
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.updatedAt,
        value: formatDateTime(dto.updatedAt),
      },
    ],
  };
}

/**
 * @param dto - the detail payload.
 * @returns the “Jogi adatok” group: names, tax numbers and the legal form.
 */
function toLegalGroup(dto: CustomerDetail): CustomerDetailGroup {
  return {
    title: CUSTOMER_DETAIL_GROUP_TITLES.legal,
    items: [
      { label: CUSTOMER_DETAIL_FIELD_LABELS.legalName, value: dto.legalName },
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.shortName,
        value: toOptionalText(dto.shortName),
      },
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.taxNumber,
        value: toOptionalText(dto.taxNumber),
      },
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.euVatNumber,
        value: toOptionalText(dto.euVatNumber),
      },
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.companyRegistrationNumber,
        value: toOptionalText(dto.companyRegistrationNumber),
      },
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.legalForm,
        value: toOptionalText(dto.legalForm),
      },
    ],
  };
}

/**
 * @param dto - the detail payload.
 * @returns the “Cím” group: the registered address, one pair per part.
 */
function toAddressGroup(dto: CustomerDetail): CustomerDetailGroup {
  return {
    title: CUSTOMER_DETAIL_GROUP_TITLES.address,
    items: [
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.zip,
        value: toOptionalText(dto.registeredAddressZip),
      },
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.city,
        value: toOptionalText(dto.registeredAddressCity),
      },
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.addressLine,
        value: toOptionalText(dto.registeredAddressLine),
      },
      // The contract types the country as an ISO 3166-1 alpha-2 code that is
      // already upper case, so it is shown as it arrives: there is no closed
      // value set to translate.
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.country,
        value: dto.registeredAddressCountry,
      },
    ],
  };
}

/**
 * @param dto - the detail payload.
 * @returns the “Egyéb” group: industry, headcount band and the last activity.
 */
function toOtherGroup(dto: CustomerDetail): CustomerDetailGroup {
  return {
    title: CUSTOMER_DETAIL_GROUP_TITLES.other,
    items: [
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.industry,
        value: toOptionalText(dto.industry),
      },
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.headcountRange,
        value:
          dto.headcountRange === null
            ? CUSTOMER_EMPTY_VALUE_LABEL
            : CUSTOMER_HEADCOUNT_RANGE_LABELS[dto.headcountRange],
      },
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.lastActivity,
        value: toOptionalDateTimeText(dto.lastActivityAt),
      },
    ],
  };
}

/**
 * Maps the detail payload onto the detail page's view model (AIS-20).
 *
 * The status is **not** one of the `overview` pairs: `CustomerStatusBadge`
 * renders it from `status`, so the badge mapping stays in {@link toStatusVariant}
 * and a badge never becomes a string.
 *
 * @param dto - body of `GET /api/admin/customers/:id`.
 * @returns the renderable detail; nothing raw or nullable survives.
 */
export function toCustomerDetailViewModel(
  dto: CustomerDetail,
): CustomerDetailViewModel {
  return {
    displayName: toDisplayName(dto),
    customerNumber: dto.customerNumber,
    status: dto.status,
    hasMissingData: dto.hasMissingData,
    overview: [
      {
        label: CUSTOMER_DETAIL_OVERVIEW_LABELS.statusChangedAt,
        value: formatDateTime(dto.statusChangedAt),
      },
      {
        label: CUSTOMER_DETAIL_OVERVIEW_LABELS.primaryContact,
        value:
          dto.primaryContactName ?? CUSTOMER_NO_PRIMARY_CONTACT_LABEL,
      },
      {
        label: CUSTOMER_DETAIL_FIELD_LABELS.lastActivity,
        value: toOptionalDateTimeText(dto.lastActivityAt),
      },
    ],
    groups: [
      toIdentifiersGroup(dto),
      toLegalGroup(dto),
      toAddressGroup(dto),
      toOtherGroup(dto),
    ],
  };
}
