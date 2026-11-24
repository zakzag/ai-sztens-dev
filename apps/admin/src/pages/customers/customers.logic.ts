/**
 * Pure rules of the `customers` page (AIS-19).
 *
 * Route building, filter-value narrowing and empty-state copy selection, all
 * testable with values alone. Anything that depends on the *contract* (the sort
 * allow-list, the active-filter test) lives in `features/customers/`, because it
 * is a use-case rule and not a page concern.
 */

import {
  CUSTOMER_SOURCE_VALUES,
  CUSTOMER_STATUS_VALUES,
  CUSTOMER_TYPE_VALUES,
  type CustomerSource,
  type CustomerStatus,
  type CustomerType,
} from '@callback/shared';
import {
  CUSTOMER_DETAIL_ROUTE_PATH,
  CUSTOMERS_EMPTY_DESCRIPTION_FILTERED,
  CUSTOMERS_EMPTY_DESCRIPTION_UNFILTERED,
} from './customers.const.js';

/**
 * Builds the detail route of one row.
 *
 * From the same template the registry mounts, so a row can never point at a path
 * the router does not serve. The id is a uuid from the API, but it is encoded
 * anyway: the function is the single place a URL is assembled, and a future
 * human-readable segment would need it.
 *
 * @param id - the customer's uuid.
 * @returns `/customers/<id>`.
 */
export function toCustomerDetailRoute(id: string): string {
  return CUSTOMER_DETAIL_ROUTE_PATH.replace(':id', encodeURIComponent(id));
}

/**
 * Builds the edit route of one row (mounted by AIS-21).
 *
 * @param id - the customer's uuid.
 * @returns `/customers/<id>/edit`.
 */
export function toCustomerEditRoute(id: string): string {
  return `${toCustomerDetailRoute(id)}/edit`;
}

/**
 * Narrows a `<select>` value onto the contract's customer types.
 *
 * `find` on the tuple instead of a cast: an unknown value becomes `undefined`
 * (“no filter”) rather than a string the server would reject.
 *
 * @param value - raw control value; `''` means “no filter”.
 * @returns the matching type, or `undefined`.
 */
export function toCustomerType(value: string): CustomerType | undefined {
  return CUSTOMER_TYPE_VALUES.find((candidate) => candidate === value);
}

/**
 * @param value - raw control value; `''` means “no filter”.
 * @returns the matching status, or `undefined`.
 */
export function toCustomerStatus(value: string): CustomerStatus | undefined {
  return CUSTOMER_STATUS_VALUES.find((candidate) => candidate === value);
}

/**
 * @param value - raw control value; `''` means “no filter”.
 * @returns the matching source, or `undefined`.
 */
export function toCustomerSource(value: string): CustomerSource | undefined {
  return CUSTOMER_SOURCE_VALUES.find((candidate) => candidate === value);
}

/**
 * Chooses the empty-state explanation.
 *
 * Two different situations produce an empty table and they need two different
 * next steps: an empty database (“create the first one”) and an over-narrow
 * filter (“clear the filters”). Asking the user to create a customer when a
 * filter hides a hundred rows would be actively misleading.
 *
 * @param hasFilters - whether the query narrows the list.
 * @returns the description to render under the empty-state title.
 */
export function toEmptyStateDescription(hasFilters: boolean): string {
  return hasFilters
    ? CUSTOMERS_EMPTY_DESCRIPTION_FILTERED
    : CUSTOMERS_EMPTY_DESCRIPTION_UNFILTERED;
}
