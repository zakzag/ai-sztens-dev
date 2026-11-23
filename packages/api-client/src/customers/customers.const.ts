/**
 * Constants of the `customers` service (AIS-178/c).
 *
 * The three paths are **derived** from the endpoint registry (AIS-89): the route
 * is written down once in `@callback/shared`, and `clientPathOf()` converts it to
 * the shape the transport expects. The base URL already contains the global
 * `/api` prefix, so the effective request is `/api/admin/customers`.
 *
 * The `admin` segment is part of the registry path on purpose: customer data is
 * back-office data, and the public site must never reach it under a shorter path
 * (`customers.const.ts` in `@callback/shared`).
 *
 * The defaults constant exists for the AIS-109 rule that a list URL carries only
 * what the user actually changed: `?page=1&sort=createdAt` must never appear in a
 * link the operator copies.
 */

import {
  CUSTOMER_DEFAULT_SORT,
  LIST_QUERY_DEFAULTS,
  type ListQueryDefaults,
} from '@callback/shared';
import { clientPathOf } from '../endpoint-path.js';

/** Path of the collection endpoint (`GET` and `POST`), relative to the base URL. */
export const CUSTOMERS_PATH = clientPathOf('customers.list');

/**
 * Path of the single-resource endpoint, still carrying `:id`.
 *
 * The placeholder is substituted by `toCustomerDetailPath()`; the transport
 * additionally refuses to send an unresolved placeholder.
 */
export const CUSTOMERS_DETAIL_PATH = clientPathOf('customers.findById');

/**
 * Path of the dedicated status change, still carrying `:id`.
 *
 * A route of its own and **not** a field of the general `PATCH`: the service also
 * writes `status_changed_at` and records a separate audit entry.
 */
export const CUSTOMERS_STATUS_PATH = clientPathOf('customers.updateStatus');

/**
 * Values that count as “unchanged” in the customers list query.
 *
 * The resource default sort is layered onto the shared list defaults, so
 * `page`/`limit`/`order` keep the contract-wide values while `sort` reflects the
 * column the customers list actually sorts by.
 */
export const CUSTOMER_LIST_QUERY_DEFAULTS: ListQueryDefaults = {
  ...LIST_QUERY_DEFAULTS,
  sort: CUSTOMER_DEFAULT_SORT,
};

/**
 * Path of the contact collection of one customer (AIS-178, slice d).
 *
 * Still carrying `:id`; the contacts list has no further placeholder, so this is
 * the path every `…/:id/contacts` call starts from.
 */
export const CUSTOMERS_CONTACTS_PATH = clientPathOf('customers.listContacts');

/**
 * Path of one contact inside its customer, still carrying `:id` and
 * `:contactId`; both are substituted by `toCustomerContactPath()`.
 */
export const CUSTOMERS_CONTACT_PATH = clientPathOf('customers.updateContact');

/**
 * Path of the tag collection of one customer (AIS-178, slice e).
 *
 * Still carrying `:id`. `POST` and `PATCH` share it — the difference between
 * "create the label if needed" and "attach an existing one" is the body, not the
 * address.
 */
export const CUSTOMERS_TAGS_PATH = clientPathOf('customers.createTag');

/**
 * Path of one tag **link** inside its customer, still carrying `:id` and
 * `:tagId`; both are substituted by `toCustomerTagPath()`.
 */
export const CUSTOMERS_TAG_PATH = clientPathOf('customers.detachTag');

/**
 * Path of the login-user collection of one customer, still carrying `:id`.
 */
export const CUSTOMERS_USERS_PATH = clientPathOf('customers.inviteCustomerUser');

/**
 * Path of one login user inside its customer, still carrying `:id` and
 * `:customerUserId`; both are substituted by `toCustomerUserPath()`.
 */
export const CUSTOMERS_USER_PATH = clientPathOf('customers.updateCustomerUser');
