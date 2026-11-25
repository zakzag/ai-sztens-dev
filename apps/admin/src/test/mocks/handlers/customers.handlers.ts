/**
 * MSW handlers of the `customers` resource (AIS-19).
 *
 * The mock point is the network, not the service: a test lets the real
 * `customersService` + `httpClient` run and only replaces the wire. The success
 * bodies come from the shared contract fixture (`@callback/shared`), so the same
 * data feeds the OpenAPI examples, the contract tests and these handlers.
 *
 * A list response **must** carry `meta.pagination` — the transport validates
 * that block as required, so a handler that forgets it produces
 * `UNEXPECTED_PAYLOAD` instead of an empty pager.
 *
 * Handlers are exported individually so a test can `server.use(...)` exactly the
 * one scenario it needs; `customersHandlers` is the default set.
 */

import { http } from 'msw';
import type {
  Activity,
  AuditLog,
  Customer,
  CustomerDetail,
  PaginationMeta,
} from '@callback/shared';
import {
  API_ERROR_CODE,
  CUSTOMERS_PATH,
  SECOND_CUSTOMER,
  VALID_ACTIVITY,
  VALID_ACTIVITY_LIST,
  VALID_AUDIT_LOG,
  VALID_AUDIT_LOG_LIST,
  VALID_CONTACT,
  VALID_CUSTOMER,
  VALID_CUSTOMER_DETAIL,
  VALID_CUSTOMER_LIST,
  VALID_CUSTOMER_USER,
  toPaginationMeta,
} from '@callback/shared';
import { errorResponse, successResponse } from './handler-envelope.js';

/** Path template of the single-resource route, as MSW matches it. */
export const CUSTOMERS_DETAIL_PATH_PATTERN = `${CUSTOMERS_PATH}/:id`;

/**
 * Pagination block of the default list response.
 *
 * Two fixture rows fit on one page, so `totalPages` is `1` — the value a pager
 * renders. The detail response deliberately carries **no** pagination block: the
 * single-resource unwrap does not require one, and inventing it would make the
 * fixture lie about the endpoint.
 */
const DEFAULT_LIST_PAGINATION: PaginationMeta = toPaginationMeta(
  { page: 1, limit: 20 },
  VALID_CUSTOMER_LIST.length,
);

/** `200` list with the fully filled row and the one that is missing data. */
export const customersListSuccess = http.get(CUSTOMERS_PATH, () =>
  successResponse(VALID_CUSTOMER_LIST, {
    pagination: DEFAULT_LIST_PAGINATION,
  }),
);

/** `200` empty list — `totalPages` is `0`, never `1`. */
export const customersListEmpty = http.get(CUSTOMERS_PATH, () =>
  successResponse([], {
    pagination: toPaginationMeta({ page: 1, limit: 20 }, 0),
  }),
);

/** `200` list holding a single row (the “filtered” result of a narrow query). */
export const customersListSingleRow = http.get(CUSTOMERS_PATH, () =>
  successResponse([SECOND_CUSTOMER], {
    pagination: toPaginationMeta({ page: 1, limit: 20 }, 1),
  }),
);

/** `500` list failure with a correlation id the retry tier can assert. */
export const customersListServerError = http.get(CUSTOMERS_PATH, () =>
  errorResponse(API_ERROR_CODE.INTERNAL_ERROR, 'Internal server error', {
    requestId: 'req-customers-server',
    path: CUSTOMERS_PATH,
  }),
);

/**
 * `200` detail of any id (AIS-20).
 *
 * The body is `VALID_CUSTOMER_DETAIL`, i.e. the same fixture the contract test
 * and the OpenAPI example use, so the page's assertions read one truth.
 */
export const customersDetailSuccess = http.get(
  CUSTOMERS_DETAIL_PATH_PATTERN,
  () => successResponse(VALID_CUSTOMER_DETAIL),
);

/** `404` detail of an id that no live customer owns. */
export const customersDetailNotFound = http.get(
  CUSTOMERS_DETAIL_PATH_PATTERN,
  ({ params }) =>
    errorResponse(API_ERROR_CODE.NOT_FOUND, 'Customer was not found', {
      path: `${CUSTOMERS_PATH}/${String(params.id)}`,
    }),
);

/** `500` detail failure with its own correlation id, for the retry tier. */
export const customersDetailServerError = http.get(
  CUSTOMERS_DETAIL_PATH_PATTERN,
  () =>
    errorResponse(API_ERROR_CODE.INTERNAL_ERROR, 'Internal server error', {
      requestId: 'req-customer-detail-server',
      path: CUSTOMERS_DETAIL_PATH_PATTERN,
    }),
);

/** `200` archive (soft delete) of any id — the envelope carries `data: null`. */
export const customersArchiveSuccess = http.delete(
  CUSTOMERS_DETAIL_PATH_PATTERN,
  () => successResponse(null),
);

/** `404` archive of an id that is already gone. */
export const customersArchiveNotFound = http.delete(
  CUSTOMERS_DETAIL_PATH_PATTERN,
  () =>
    errorResponse(API_ERROR_CODE.NOT_FOUND, 'Customer was not found', {
      path: `${CUSTOMERS_PATH}/ghost`,
    }),
);

/**
 * The rows the default list handler serves, re-exported for assertions.
 *
 * A test that checks a mapped cell should read the same object the handler
 * returned, not a second literal that can drift from the fixture.
 */
export const CUSTOMER_LIST_FIXTURES: readonly Customer[] = VALID_CUSTOMER_LIST;

/** The single fixture row a detail-shaped assertion needs. */
export const CUSTOMER_FIXTURE: Customer = VALID_CUSTOMER;

/**
 * The payload the detail handler serves, re-exported for assertions.
 *
 * A test that checks a mapped field reads this object instead of a second
 * literal that can drift from the fixture.
 */
export const CUSTOMER_DETAIL_FIXTURE: CustomerDetail = VALID_CUSTOMER_DETAIL;

/**
 * Path template of the dedicated status route, as MSW matches it (AIS-21).
 *
 * A route of its own: the server also writes `statusChangedAt` and records a
 * separate audit entry, so it is never part of the field `PATCH`.
 */
export const CUSTOMERS_STATUS_PATH_PATTERN = `${CUSTOMERS_PATH}/:id/status`;

/**
 * `200` field update (`PATCH /:id`) — answers the current fixture row (AIS-21).
 *
 * The request body is not asserted here: a test that cares about the payload
 * attaches `createRequestRecorder()` and reads the recorded request, which is the
 * same place every other write's body is checked.
 */
export const customersUpdateSuccess = http.patch(
  CUSTOMERS_DETAIL_PATH_PATTERN,
  () => successResponse(VALID_CUSTOMER),
);

/**
 * `422 SEMANTIC_VALIDATION_FAILED` naming one input (`legalName`).
 *
 * The `details[].path` is what the form maps onto a control, so this handler is
 * the proof of the `details → input` contract, not of any copy.
 */
export const customersUpdateValidationError = http.patch(
  CUSTOMERS_DETAIL_PATH_PATTERN,
  () =>
    errorResponse(
      API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED,
      'Legal name is not acceptable',
      {
        details: [{ path: 'legalName', message: 'Legal name is not acceptable' }],
        path: CUSTOMERS_DETAIL_PATH_PATTERN,
      },
    ),
);

/**
 * `409 CUSTOMER_TAX_NUMBER_CONFLICT` with the addressable path the contract sends.
 *
 * `details[0].path === 'taxNumber'` is part of the published contract
 * (`customers.interface.ts` of `@callback/api-client`), so the handler carries it:
 * the surface stays `field` and the form puts the copy under the input instead of
 * raising a page-level alert.
 */
export const customersUpdateTaxConflict = http.patch(
  CUSTOMERS_DETAIL_PATH_PATTERN,
  () =>
    errorResponse(
      API_ERROR_CODE.CUSTOMER_TAX_NUMBER_CONFLICT,
      'Tax number is already in use',
      {
        details: [{ path: 'taxNumber', message: 'Tax number is already in use' }],
        path: CUSTOMERS_DETAIL_PATH_PATTERN,
      },
    ),
);

/** `409 STALE_WRITE` — the row was saved by somebody else after the read. */
export const customersUpdateStaleWrite = http.patch(
  CUSTOMERS_DETAIL_PATH_PATTERN,
  () =>
    errorResponse(API_ERROR_CODE.STALE_WRITE, 'The row was modified meanwhile', {
      path: CUSTOMERS_DETAIL_PATH_PATTERN,
    }),
);

/** `500` on the field update. */
export const customersUpdateServerError = http.patch(
  CUSTOMERS_DETAIL_PATH_PATTERN,
  () =>
    errorResponse(API_ERROR_CODE.INTERNAL_ERROR, 'Internal server error', {
      requestId: 'req-customer-update-server',
      path: CUSTOMERS_DETAIL_PATH_PATTERN,
    }),
);

/** `200` status change (`PATCH /:id/status`). */
export const customersStatusSuccess = http.patch(
  CUSTOMERS_STATUS_PATH_PATTERN,
  () => successResponse(VALID_CUSTOMER),
);

/** `409 STALE_WRITE` on the status change. */
export const customersStatusStaleWrite = http.patch(
  CUSTOMERS_STATUS_PATH_PATTERN,
  () =>
    errorResponse(API_ERROR_CODE.STALE_WRITE, 'The row was modified meanwhile', {
      path: CUSTOMERS_STATUS_PATH_PATTERN,
    }),
);

/** Path templates of the contact writes (AIS-179), as MSW matches them. */
export const CUSTOMERS_CONTACTS_PATH_PATTERN = `${CUSTOMERS_PATH}/:id/contacts`;
export const CUSTOMERS_CONTACT_PATH_PATTERN = `${CUSTOMERS_PATH}/:id/contacts/:contactId`;

/** Path templates of the login-user writes (AIS-179). */
export const CUSTOMERS_USERS_PATH_PATTERN = `${CUSTOMERS_PATH}/:id/customer-users`;
export const CUSTOMERS_USER_PATH_PATTERN = `${CUSTOMERS_PATH}/:id/customer-users/:customerUserId`;

/** `201` contact creation — answers the first contact of the detail fixture. */
export const customersContactCreateSuccess = http.post(
  CUSTOMERS_CONTACTS_PATH_PATTERN,
  () => successResponse(VALID_CONTACT),
);

/**
 * `409 CUSTOMER_PRIMARY_CONTACT_CONFLICT` with the `roles` path.
 *
 * The role set is what the operator can change, so the envelope names it: the
 * form maps the message onto the role checkbox group (plan decision `D7`).
 */
export const customersContactCreatePrimaryConflict = http.post(
  CUSTOMERS_CONTACTS_PATH_PATTERN,
  () =>
    errorResponse(
      API_ERROR_CODE.CUSTOMER_PRIMARY_CONTACT_CONFLICT,
      'The customer already has a primary contact',
      {
        details: [
          {
            path: 'roles',
            message: 'A cégnek már van elsődleges kapcsolattartója.',
          },
        ],
        path: CUSTOMERS_CONTACTS_PATH_PATTERN,
      },
    ),
);

/** `200` contact patch — answers the updated fixture row. */
export const customersContactUpdateSuccess = http.patch(
  CUSTOMERS_CONTACT_PATH_PATTERN,
  () => successResponse(VALID_CONTACT),
);

/** `409 STALE_WRITE` on a contact patch. */
export const customersContactUpdateStaleWrite = http.patch(
  CUSTOMERS_CONTACT_PATH_PATTERN,
  () =>
    errorResponse(API_ERROR_CODE.STALE_WRITE, 'The row was modified meanwhile', {
      path: CUSTOMERS_CONTACT_PATH_PATTERN,
    }),
);

/** `200` contact archive — the envelope carries `data: null`. */
export const customersContactRemoveSuccess = http.delete(
  CUSTOMERS_CONTACT_PATH_PATTERN,
  () => successResponse(null),
);

/** `201` invitation — answers the login user of the detail fixture. */
export const customersUserInviteSuccess = http.post(
  CUSTOMERS_USERS_PATH_PATTERN,
  () => successResponse(VALID_CUSTOMER_USER),
);

/** `409 CUSTOMER_USER_EMAIL_CONFLICT` with the `email` path (global address). */
export const customersUserInviteEmailConflict = http.post(
  CUSTOMERS_USERS_PATH_PATTERN,
  () =>
    errorResponse(
      API_ERROR_CODE.CUSTOMER_USER_EMAIL_CONFLICT,
      'The e-mail address is already in use',
      {
        details: [
          { path: 'email', message: 'Ez az e-mail-cím már használatban van.' },
        ],
        path: CUSTOMERS_USERS_PATH_PATTERN,
      },
    ),
);

/** `200` login-user patch — answers the updated fixture row. */
export const customersUserUpdateSuccess = http.patch(
  CUSTOMERS_USER_PATH_PATTERN,
  () => successResponse(VALID_CUSTOMER_USER),
);

/** `409 CUSTOMER_OWNER_CONFLICT` with the `role` path. */
export const customersUserUpdateOwnerConflict = http.patch(
  CUSTOMERS_USER_PATH_PATTERN,
  () =>
    errorResponse(
      API_ERROR_CODE.CUSTOMER_OWNER_CONFLICT,
      'The customer already has an active owner',
      {
        details: [
          {
            path: 'role',
            message: 'A cégnek már van aktív tulajdonosa.',
          },
        ],
        path: CUSTOMERS_USER_PATH_PATTERN,
      },
    ),
);

/** `200` invitation revoke — the envelope carries `data: null`. */
export const customersUserRemoveSuccess = http.delete(
  CUSTOMERS_USER_PATH_PATTERN,
  () => successResponse(null),
);

/**
 * The contact and login-user fixtures the handlers answer with, re-exported for
 * assertions — a tab test reads the same object the wire carried.
 */
export const CUSTOMER_CONTACT_FIXTURES = VALID_CUSTOMER_DETAIL.contacts;
export const CUSTOMER_USER_FIXTURES = VALID_CUSTOMER_DETAIL.customerUsers;

// ---------------------------------------------------------------------------
// AIS-181 — the activity feed and the audit ledger
// ---------------------------------------------------------------------------

/**
 * Path templates of the two paged child collections (AIS-181).
 *
 * Built from `CUSTOMERS_PATH` like every pattern above, so a change of the
 * resource root cannot leave a stale handler behind.
 */
export const CUSTOMERS_ACTIVITIES_PATH_PATTERN = `${CUSTOMERS_PATH}/:id/activities`;
export const CUSTOMERS_ACTIVITY_PATH_PATTERN = `${CUSTOMERS_PATH}/:id/activities/:activityId`;
export const CUSTOMERS_AUDIT_LOGS_PATH_PATTERN = `${CUSTOMERS_PATH}/:id/audit-logs`;

/** Pagination block of the two-row activity fixture page. */
const ACTIVITY_PAGE_PAGINATION: PaginationMeta = toPaginationMeta(
  { page: 1, limit: 20 },
  VALID_ACTIVITY_LIST.length,
);

/** `200` activity page — one operator entry and one system entry. */
export const customersActivitiesSuccess = http.get(
  CUSTOMERS_ACTIVITIES_PATH_PATTERN,
  () =>
    successResponse(VALID_ACTIVITY_LIST, {
      pagination: ACTIVITY_PAGE_PAGINATION,
    }),
);

/** `200` empty activity page — `totalPages` is `0`, never `1`. */
export const customersActivitiesEmpty = http.get(
  CUSTOMERS_ACTIVITIES_PATH_PATTERN,
  () =>
    successResponse([], {
      pagination: toPaginationMeta({ page: 1, limit: 20 }, 0),
    }),
);

/** `500` activity page failure with its own correlation id. */
export const customersActivitiesServerError = http.get(
  CUSTOMERS_ACTIVITIES_PATH_PATTERN,
  () =>
    errorResponse(API_ERROR_CODE.INTERNAL_ERROR, 'Internal server error', {
      requestId: 'req-customer-activities-server',
      path: CUSTOMERS_ACTIVITIES_PATH_PATTERN,
    }),
);

/** `201` activity creation — answers the operator fixture row. */
export const customerActivityCreateSuccess = http.post(
  CUSTOMERS_ACTIVITIES_PATH_PATTERN,
  () => successResponse(VALID_ACTIVITY),
);

/** `200` activity patch — answers the operator fixture row. */
export const customerActivityUpdateSuccess = http.patch(
  CUSTOMERS_ACTIVITY_PATH_PATTERN,
  () => successResponse(VALID_ACTIVITY),
);

/** `409 STALE_WRITE` on an activity patch. */
export const customerActivityUpdateStaleWrite = http.patch(
  CUSTOMERS_ACTIVITY_PATH_PATTERN,
  () =>
    errorResponse(API_ERROR_CODE.STALE_WRITE, 'The row was modified meanwhile', {
      path: CUSTOMERS_ACTIVITY_PATH_PATTERN,
    }),
);

/** `200` activity soft delete — the envelope carries `data: null`. */
export const customerActivityRemoveSuccess = http.delete(
  CUSTOMERS_ACTIVITY_PATH_PATTERN,
  () => successResponse(null),
);

/** `200` audit-log page — one `insert` row, authored by `system`. */
export const customersAuditLogsSuccess = http.get(
  CUSTOMERS_AUDIT_LOGS_PATH_PATTERN,
  () =>
    successResponse(VALID_AUDIT_LOG_LIST, {
      pagination: toPaginationMeta(
        { page: 1, limit: 20 },
        VALID_AUDIT_LOG_LIST.length,
      ),
    }),
);

/** `200` empty audit-log page. */
export const customersAuditLogsEmpty = http.get(
  CUSTOMERS_AUDIT_LOGS_PATH_PATTERN,
  () =>
    successResponse([], {
      pagination: toPaginationMeta({ page: 1, limit: 20 }, 0),
    }),
);

/** `500` audit-log page failure with its own correlation id. */
export const customersAuditLogsServerError = http.get(
  CUSTOMERS_AUDIT_LOGS_PATH_PATTERN,
  () =>
    errorResponse(API_ERROR_CODE.INTERNAL_ERROR, 'Internal server error', {
      requestId: 'req-customer-audit-logs-server',
      path: CUSTOMERS_AUDIT_LOGS_PATH_PATTERN,
    }),
);

/**
 * The activity and ledger fixtures the handlers answer with, re-exported for
 * assertions — a tab test reads the same object the wire carried.
 */
export const CUSTOMER_ACTIVITY_FIXTURES: readonly Activity[] =
  VALID_ACTIVITY_LIST;
export const CUSTOMER_AUDIT_LOG_FIXTURES: readonly AuditLog[] =
  VALID_AUDIT_LOG_LIST;
export const CUSTOMER_AUDIT_LOG_FIXTURE: AuditLog = VALID_AUDIT_LOG;

/**
 * Default handler set registered by the global server.
 *
 * The three **reads** of the detail surface are part of it: the detail page is
 * mounted by the router and its two paged tabs fetch as soon as they are opened,
 * so a test that mounts the app must find every read endpoint by default instead
 * of a network error. The **write** handlers are not: a test that writes registers
 * exactly the outcome it asserts (AIS-21, AIS-181).
 */
export const customersHandlers = [
  customersListSuccess,
  customersDetailSuccess,
  customersActivitiesSuccess,
  customersAuditLogsSuccess,
];
