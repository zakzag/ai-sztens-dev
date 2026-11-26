/**
 * Constants of the `customers` use case (AIS-19).
 *
 * The query keys are declared **once** here and derived from the resource
 * namespace by {@link createEntityQueryKeys}, so `list`/`detail` always start
 * with `all` and an invalidation can never stop matching because of a mistyped
 * literal (AIS-175).
 *
 * The page sizes are injected by the consumer of the pager, exactly as
 * `api-keys.const.ts` does: `packages/ui` must not import `@callback/shared`, so
 * the numbers are named here, where the contract is already known.
 */

import {
  API_ERROR_CODE,
  LIST_QUERY_DEFAULT_LIMIT,
  LIST_QUERY_MAX_LIMIT,
  type Activity,
  type ActivityListQuery,
  type AuditLog,
  type AuditLogListQuery,
  type Customer,
  type CustomerListQuery,
} from '@callback/shared';
import { createEntityQueryKeys } from '../api/create-entity-query-keys.js';
import type {
  CustomerActivityFormFieldName,
  CustomerContactFormFieldName,
  CustomerCreateFieldName,
  CustomerUpdateFieldName,
  CustomerUserEditFormFieldName,
  CustomerUserInviteFormFieldName,
} from './customers.interface.js';

/**
 * Cache keys of the `customers` queries.
 *
 * `all` is the prefix every `customers` query shares; `list` is a factory
 * because the response depends on the query (page, sort, filters, search), and
 * `detail` is reserved for AIS-20 — it is declared by the factory, not by hand.
 */
export const CUSTOMERS_QUERY_KEYS = createEntityQueryKeys<CustomerListQuery>(
  'customers',
);

/**
 * Rows returned while there is no data yet (loading or failed).
 *
 * A frozen constant, not a fresh `[]`: `useApiList` requires a stable reference,
 * otherwise the table sees a new array identity on every render.
 */
export const EMPTY_CUSTOMER_LIST: readonly Customer[] = Object.freeze([]);

/** Page sizes the customers pager offers: default, a middle value, the maximum. */
export const CUSTOMERS_LIMIT_OPTIONS: readonly number[] = Object.freeze([
  LIST_QUERY_DEFAULT_LIMIT,
  50,
  LIST_QUERY_MAX_LIMIT,
]);

/**
 * Success message of the archive write.
 *
 * Lives here (and not in the page) because the mutation owns its own feedback:
 * the page only triggers the write, and the notification capture renders
 * `meta.successMessage` once.
 */
export const CUSTOMERS_ARCHIVE_SUCCESS_MESSAGE = 'A cég archiválva.';

/**
 * Success copy of the field update (AIS-21).
 *
 * Handed to `useAppForm`'s notify port — **not** to the mutation's `meta`: a page
 * never sets `meta.successMessage` (`New-Admin-Page.md` step 15 / AIS-136), the
 * form's port owns the announcement, and the two must not both speak.
 */
export const CUSTOMERS_UPDATE_SUCCESS_MESSAGE = 'A cég adatai mentve.';

/** Success copy of the dedicated status change (AIS-21). */
export const CUSTOMERS_STATUS_SUCCESS_MESSAGE = 'A cég státusza módosítva.';

/**
 * Success copy of the create wizard (AIS-182).
 *
 * Handed to the review step's notify port — never to the mutation's `meta`: the
 * form owns the announcement (`New-Admin-Page.md` step 15 / AIS-136).
 */
export const CUSTOMERS_CREATE_SUCCESS_MESSAGE = 'A cég létrejött.';

/**
 * Every input the **create wizard** owns, in visual order (AIS-182).
 *
 * Step 2's six fields first, then step 3's four — the same order the steps
 * render, so a `422`'s first focus lands on the earliest offending input. The
 * order is the contract of the focus behaviour, exactly like
 * {@link CUSTOMER_UPDATE_FIELD_PATHS}.
 */
export const CUSTOMER_CREATE_FIELD_PATHS: readonly CustomerCreateFieldName[] =
  Object.freeze([
    'legalName',
    'shortName',
    'taxNumber',
    'euVatNumber',
    'companyRegistrationNumber',
    'legalForm',
    'registeredAddressZip',
    'registeredAddressCity',
    'registeredAddressLine',
    'registeredAddressCountry',
  ]);

/**
 * Path a code blames when the response carried no `details[]` (AIS-182).
 *
 * Only the duplicate tax number has an input to blame, and that input lives on
 * the wizard's second step — which is why the page maps the blamed path back to
 * its step before navigating.
 */
export const CUSTOMER_CREATE_DEFAULT_PATH_BY_CODE: Readonly<
  Record<string, CustomerCreateFieldName>
> = Object.freeze({
  [API_ERROR_CODE.CUSTOMER_TAX_NUMBER_CONFLICT]: 'taxNumber',
});

/**
 * Every input the **edit** form owns, in visual order (AIS-21).
 *
 * The order is the contract of the focus behaviour: server errors are applied in
 * this order and only the first one takes focus (AIS-111 `D3`), so a component
 * cannot change the outcome by reordering its markup.
 *
 * The read-only-by-contract fields (`customerNumber`, `status`, `createdAt`,
 * `updatedAt`, `hasMissingData`) are absent — the request schema is `.strict()`
 * and rejects them, so they can never be an error target.
 */
export const CUSTOMER_UPDATE_FIELD_PATHS: readonly CustomerUpdateFieldName[] =
  Object.freeze([
    'type',
    'legalName',
    'shortName',
    'taxNumber',
    'euVatNumber',
    'companyRegistrationNumber',
    'legalForm',
    'registeredAddressZip',
    'registeredAddressCity',
    'registeredAddressLine',
    'registeredAddressCountry',
    'industry',
    'headcountRange',
    'source',
  ]);

/**
 * Path a code blames when the response carried no `details[]` (AIS-21).
 *
 * Only the duplicate tax number has an input to blame. `STALE_WRITE` is not
 * listed: the path it would blame (`updatedAt`) is rendered nowhere, which is
 * exactly why the form answers it with a page-level notice instead of a field
 * message.
 */
export const CUSTOMER_UPDATE_DEFAULT_PATH_BY_CODE: Readonly<
  Record<string, CustomerUpdateFieldName>
> = Object.freeze({
  [API_ERROR_CODE.CUSTOMER_TAX_NUMBER_CONFLICT]: 'taxNumber',
});

/** Success copy of the three contact writes (AIS-179). */
export const CUSTOMERS_CONTACT_CREATE_SUCCESS_MESSAGE =
  'A kapcsolattartó hozzáadva.';
export const CUSTOMERS_CONTACT_UPDATE_SUCCESS_MESSAGE =
  'A kapcsolattartó adatai mentve.';
export const CUSTOMERS_CONTACT_REMOVE_SUCCESS_MESSAGE =
  'A kapcsolattartó archiválva.';

/** Success copy of the three login-user writes (AIS-179). */
export const CUSTOMERS_USER_INVITE_SUCCESS_MESSAGE = 'A meghívó elküldve.';
export const CUSTOMERS_USER_UPDATE_SUCCESS_MESSAGE =
  'A felhasználó adatai mentve.';
export const CUSTOMERS_USER_REMOVE_SUCCESS_MESSAGE = 'A meghívó visszavonva.';

/**
 * Every input the **contact** form owns, in visual order (AIS-179).
 *
 * Same contract as {@link CUSTOMER_UPDATE_FIELD_PATHS}: server errors are applied
 * in this order and only the first one takes focus, so the markup cannot change
 * the outcome by reordering its controls.
 */
export const CUSTOMER_CONTACT_FIELD_PATHS: readonly CustomerContactFormFieldName[] =
  Object.freeze([
    'name',
    'position',
    'email',
    'phone',
    'customerUserId',
    'isPrimary',
    'isTechnical',
    'isAlerting',
    'isActive',
  ]);

/**
 * Path the primary-contact conflict blames (AIS-179).
 *
 * The server rejects the write when a second contact would hold the `primary`
 * role, and the only control that can fix it is the role checkbox group — so the
 * message lands there instead of on the form.
 */
export const CUSTOMER_CONTACT_DEFAULT_PATH_BY_CODE: Readonly<
  Record<string, CustomerContactFormFieldName>
> = Object.freeze({
  [API_ERROR_CODE.CUSTOMER_PRIMARY_CONTACT_CONFLICT]: 'isPrimary',
});

/** Every input the **invite** form owns, in visual order (AIS-179). */
export const CUSTOMER_USER_INVITE_FIELD_PATHS: readonly CustomerUserInviteFormFieldName[] =
  Object.freeze(['name', 'email', 'role']);

/**
 * Path the duplicate e-mail conflict blames (AIS-179).
 *
 * `CUSTOMER_USER_EMAIL_CONFLICT` is global — an address belongs to at most one
 * login user anywhere — and the address is the only input that can fix it.
 */
export const CUSTOMER_USER_INVITE_DEFAULT_PATH_BY_CODE: Readonly<
  Record<string, CustomerUserInviteFormFieldName>
> = Object.freeze({
  [API_ERROR_CODE.CUSTOMER_USER_EMAIL_CONFLICT]: 'email',
});

/** Every input the **login-user edit** form owns, in visual order (AIS-179). */
export const CUSTOMER_USER_EDIT_FIELD_PATHS: readonly CustomerUserEditFormFieldName[] =
  Object.freeze(['name', 'role', 'status']);

/** Path the second-owner conflict blames: the role control (AIS-179). */
export const CUSTOMER_USER_EDIT_DEFAULT_PATH_BY_CODE: Readonly<
  Record<string, CustomerUserEditFormFieldName>
> = Object.freeze({
  [API_ERROR_CODE.CUSTOMER_OWNER_CONFLICT]: 'role',
});

/**
 * Cache keys of the customer **activity feed** (AIS-181).
 *
 * `createEntityQueryKeys` models the customer's own `list`/`detail`; a child
 * collection needs its own key, and deriving it from `CUSTOMERS_QUERY_KEYS.all`
 * is what keeps **one** invalidation prefix: `invalidateQueries(customers.all)`
 * refreshes the feed, the detail (`lastActivityAt` is derived from the feed) and
 * the list row with a single call.
 */
export const CUSTOMER_ACTIVITIES_QUERY_KEYS = {
  /** Prefix of every activity query of every customer. */
  all: [...CUSTOMERS_QUERY_KEYS.all, 'activities'] as const,
  /** One key per customer **and** per paged query. */
  list: (customerId: string, params: ActivityListQuery) =>
    [...CUSTOMERS_QUERY_KEYS.all, 'activities', customerId, params] as const,
};

/**
 * Cache keys of the read-only **audit log** of one customer (AIS-181).
 *
 * Same derivation as {@link CUSTOMER_ACTIVITIES_QUERY_KEYS}, so the ledger is
 * refreshed by the same `customers` prefix — a write anywhere in the aggregate
 * legitimately appends a row here.
 */
export const CUSTOMER_AUDIT_LOGS_QUERY_KEYS = {
  /** Prefix of every audit-log query of every customer. */
  all: [...CUSTOMERS_QUERY_KEYS.all, 'audit-logs'] as const,
  /** One key per customer **and** per filtered query. */
  list: (customerId: string, params: AuditLogListQuery) =>
    [...CUSTOMERS_QUERY_KEYS.all, 'audit-logs', customerId, params] as const,
};

/** Rows the feed returns until a response arrives — a stable, frozen `[]`. */
export const EMPTY_ACTIVITY_LIST: readonly Activity[] = Object.freeze([]);

/** Rows the ledger returns until a response arrives — a stable, frozen `[]`. */
export const EMPTY_AUDIT_LOG_LIST: readonly AuditLog[] = Object.freeze([]);

/**
 * Success copy of the two activity **form** writes (AIS-181).
 *
 * Handed to `useAppForm`'s notify port, never to the mutation's `meta`: the form
 * owns the announcement (AIS-136), and the delete — which has no form — carries
 * its own `meta.successMessage` below.
 */
export const CUSTOMERS_ACTIVITY_CREATE_SUCCESS_MESSAGE =
  'A bejegyzés rögzítve.';
export const CUSTOMERS_ACTIVITY_UPDATE_SUCCESS_MESSAGE =
  'A bejegyzés módosítva.';

/** Success copy of the activity soft delete (AIS-181). */
export const CUSTOMERS_ACTIVITY_REMOVE_SUCCESS_MESSAGE =
  'A bejegyzés törölve.';

/** Every input the **activity** form owns, in visual order (AIS-181). */
export const CUSTOMER_ACTIVITY_FIELD_PATHS: readonly CustomerActivityFormFieldName[] =
  Object.freeze(['type', 'body']);
