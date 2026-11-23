/**
 * Path building of the `customers` single-resource routes (AIS-178/c).
 *
 * Kept out of the service so the substitution is a pure, testable function: the
 * registry owns the templates (`/admin/customers/:id`,
 * `/admin/customers/:id/status`), the service only says *which* customer to
 * address, and this module is the only place that knows how the placeholder
 * looks.
 *
 * Both functions encode the id. The contract types it as a uuid, so encoding can
 * never change a valid request — it only guarantees that an unexpected value
 * produces a `404` instead of an unroutable path (the same choice
 * `api-keys.path.ts` made).
 */

import { CUSTOMERS_CONTACT_ID_PARAM, CUSTOMERS_ID_PARAM } from '@callback/shared';
import {
  CUSTOMERS_CONTACTS_PATH,
  CUSTOMERS_CONTACT_PATH,
  CUSTOMERS_DETAIL_PATH,
  CUSTOMERS_STATUS_PATH,
} from './customers.const.js';

/**
 * Substitutes the customer id into the detail path.
 *
 * @param id - the customer's uuid.
 * @returns the path relative to the injected base URL, e.g.
 *   `/admin/customers/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d`.
 */
export function toCustomerDetailPath(id: string): string {
  return CUSTOMERS_DETAIL_PATH.replace(
    CUSTOMERS_ID_PARAM,
    encodeURIComponent(id),
  );
}

/**
 * Substitutes the customer id into the status path.
 *
 * @param id - the customer's uuid.
 * @returns the path relative to the injected base URL, e.g.
 *   `/admin/customers/<id>/status`.
 */
export function toCustomerStatusPath(id: string): string {
  return CUSTOMERS_STATUS_PATH.replace(
    CUSTOMERS_ID_PARAM,
    encodeURIComponent(id),
  );
}

/**
 * Substitutes the customer id into the contact collection path.
 *
 * @param customerId - the customer's uuid.
 * @returns the path relative to the injected base URL, e.g.
 *   `/admin/customers/<id>/contacts`.
 */
export function toCustomerContactsPath(customerId: string): string {
  return CUSTOMERS_CONTACTS_PATH.replace(
    CUSTOMERS_ID_PARAM,
    encodeURIComponent(customerId),
  );
}

/**
 * Substitutes both ids into the single-contact path.
 *
 * The order matters only for readability: `:id` cannot match inside
 * `:contactId` (the placeholder is `:` followed by `contactId`), so the two
 * substitutions never interfere.
 *
 * @param customerId - the customer's uuid.
 * @param contactId - the contact's uuid.
 * @returns the path relative to the injected base URL.
 */
export function toCustomerContactPath(
  customerId: string,
  contactId: string,
): string {
  return CUSTOMERS_CONTACT_PATH.replace(
    CUSTOMERS_ID_PARAM,
    encodeURIComponent(customerId),
  ).replace(CUSTOMERS_CONTACT_ID_PARAM, encodeURIComponent(contactId));
}
