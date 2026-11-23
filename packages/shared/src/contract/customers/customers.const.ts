/**
 * Constants of the `customers` resource (AIS-16).
 *
 * Every number, pattern and route segment a server controller, a client service
 * or an admin form needs is defined here **once**. The zod schemas are built
 * from these symbols, so the browser and the server cannot enforce two
 * different sets of limits (the same rule that
 * `api-keys.const.ts` follows).
 *
 * Length limits reuse the shared text constants where they mean the same thing:
 * a legal name is a short text field, an activity body is a long one. A literal
 * `200` here would be a second truth.
 */

import { LONG_TEXT_MAX_LENGTH, SHORT_TEXT_MAX_LENGTH } from '../common/format.const.js';

/**
 * Route of the collection.
 *
 * The `admin` segment is deliberate: customer data is back-office data, and the
 * public site must never be able to reach it under a shorter path. Mounted under
 * the global `api` prefix from `apps/api/src/main.ts`.
 */
export const CUSTOMERS_PATH = '/api/admin/customers';

/** Nest path-parameter placeholder of the single-resource route. */
export const CUSTOMERS_ID_PARAM = ':id';

/**
 * Nest path-parameter placeholder of the contact routes (AIS-178, slice d).
 *
 * The contact id lives **under** the customer path
 * (`…/:id/contacts/:contactId`), because a contact is only addressable inside its
 * own customer: that is what keeps one customer's contact from being reachable
 * with another customer's id.
 */
export const CUSTOMERS_CONTACT_ID_PARAM = ':contactId';

/**
 * Nest path-parameter placeholder of the tag detach route (AIS-178, slice e).
 *
 * `…/:id/tags/:tagId` — the tag id is a path parameter only on `DELETE`; the
 * attach route carries it in the body, because there the addressed resource is
 * the customer's tag collection, not one link.
 */
export const CUSTOMERS_TAG_ID_PARAM = ':tagId';

/**
 * Nest path-parameter placeholder of the customer-user routes (AIS-178, slice e).
 *
 * Same nesting rule as the contact id: a login user is addressable only inside
 * its own customer (`…/:id/customer-users/:customerUserId`).
 */
export const CUSTOMERS_CUSTOMER_USER_ID_PARAM = ':customerUserId';

/**
 * Shape of the generated customer number: `AIS-YYYYMM-NNN`.
 *
 * Six year-month digits (`202609`) and a three-digit sequence, so one month can
 * hold 999 new customers before the format has to grow. The number is generated
 * by the server (AIS-178: `max()` of the month inside the write transaction,
 * with one retry on a `23505`), and this pattern only guards the wire contract
 * against a malformed value.
 */
export const CUSTOMER_NUMBER_PATTERN = /^AIS-\d{6}-\d{3}$/;

/** Exact length of a formatted customer number (`AIS-YYYYMM-NNN`). */
export const CUSTOMER_NUMBER_MAX_LENGTH = 14;

/** Max length of the official name (`legal_name`). */
export const CUSTOMER_LEGAL_NAME_MAX_LENGTH = SHORT_TEXT_MAX_LENGTH;

/** Max length of the display name (`short_name`). */
export const CUSTOMER_SHORT_NAME_MAX_LENGTH = SHORT_TEXT_MAX_LENGTH;

/** Max length of a legal form label (`legal_form`). */
export const CUSTOMER_LEGAL_FORM_MAX_LENGTH = SHORT_TEXT_MAX_LENGTH;

/** Max length of the industry label (`industry`). */
export const CUSTOMER_INDUSTRY_MAX_LENGTH = SHORT_TEXT_MAX_LENGTH;

/** Max length of a city name in the registered address. */
export const CUSTOMER_ADDRESS_CITY_MAX_LENGTH = SHORT_TEXT_MAX_LENGTH;

/** Max length of the street/house-number line of the registered address. */
export const CUSTOMER_ADDRESS_LINE_MAX_LENGTH = SHORT_TEXT_MAX_LENGTH;

/**
 * Shape of the registered-address country: ISO 3166-1 alpha-2, upper case.
 *
 * Not a closed enum: the country list is data, and a validation error for a
 * country we have not listed yet would be worse than accepting it.
 */
export const CUSTOMER_COUNTRY_PATTERN = /^[A-Z]{2}$/;

/** Country used when the request does not name one (the column default). */
export const CUSTOMER_DEFAULT_COUNTRY = 'HU';

/**
 * Status a newly created customer starts in.
 *
 * `prospect`, not `registered`: creating a record is an operator's act, and the
 * customer has not registered anywhere yet. The value lives here (and not in the
 * service) because it is part of the published request contract — a client that
 * omits `status` must be able to predict what it gets back.
 */
export const CUSTOMER_INITIAL_STATUS = 'prospect';

/** Max length of the EU VAT number (`eu_vat_number`). */
export const CUSTOMER_EU_VAT_NUMBER_MAX_LENGTH = 20;

/** Max length of the company registration number (`company_registration_number`). */
export const CUSTOMER_REGISTRATION_NUMBER_MAX_LENGTH = 30;

/** Max length of a contact position label. */
export const CONTACT_POSITION_MAX_LENGTH = SHORT_TEXT_MAX_LENGTH;

/** Max length of a contact name. */
export const CONTACT_NAME_MAX_LENGTH = SHORT_TEXT_MAX_LENGTH;

/** Max length of a tag name. */
export const CUSTOMER_TAG_NAME_MAX_LENGTH = SHORT_TEXT_MAX_LENGTH;

/** Max length of a customer user name. */
export const CUSTOMER_USER_NAME_MAX_LENGTH = SHORT_TEXT_MAX_LENGTH;

/**
 * Statuses an operator may set on a login user (AIS-178, slice e).
 *
 * `invited` is deliberately absent: an invitation is created by
 * `POST /:id/customer-users` and `invited` is therefore a server-written state.
 * A client that could patch it back would be able to resurrect an invitation
 * whose `invitedAt` is already history — the same reasoning that keeps `status`
 * out of the customer `PATCH` (AIS-16 `D2`).
 */
export const CUSTOMER_USER_MANAGED_STATUS_VALUES = ['active', 'inactive'] as const;

/** Max length of an activity body. */
export const ACTIVITY_BODY_MAX_LENGTH = LONG_TEXT_MAX_LENGTH;

/** Max length of the author name snapshot on an activity or audit row. */
export const ACTIVITY_AUTHOR_NAME_MAX_LENGTH = SHORT_TEXT_MAX_LENGTH;

/**
 * Max length of the stored user agent (`audit_logs.user_agent`).
 *
 * 512 is the practical ceiling of what a browser sends; a longer value is a
 * probe, not a client.
 */
export const AUDIT_USER_AGENT_MAX_LENGTH = 512;

/** Max length of an IP address string — 45 is the longest IPv6 form. */
export const AUDIT_IP_ADDRESS_MAX_LENGTH = 45;

/** Max length of the correlation id stored in the audit log. */
export const AUDIT_REQUEST_ID_MAX_LENGTH = 200;

/**
 * The columns `GET /api/admin/customers` can be sorted by.
 *
 * A closed tuple: it feeds the zod enum (validation) **and** the OpenAPI enum
 * (documentation), so a column cannot be documented without being sortable.
 *
 * `lastActivityAt` is a *derived* value (the newest activity timestamp). It is
 * sortable because the list is read “who was touched last”, but it is never a
 * stored column — see the projection note in AIS-178.
 */
export const CUSTOMER_SORT_FIELDS = [
  'customerNumber',
  'legalName',
  'shortName',
  'status',
  'createdAt',
  'updatedAt',
  'lastActivityAt',
] as const;

/** One sortable column of the `customers` list. */
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];

/** The column the list is sorted by when the request does not say. */
export const CUSTOMER_DEFAULT_SORT: CustomerSortField = 'createdAt';
