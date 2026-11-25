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
import type { Customer, CustomerDetail, PaginationMeta } from '@callback/shared';
import {
  API_ERROR_CODE,
  CUSTOMERS_PATH,
  SECOND_CUSTOMER,
  VALID_CUSTOMER,
  VALID_CUSTOMER_DETAIL,
  VALID_CUSTOMER_LIST,
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
 * Default handler set registered by the global server.
 *
 * The detail read is part of it: the detail page is mounted by the router, so a
 * test that mounts the app (not just one page) must find a working detail
 * endpoint by default instead of a network error.
 */
export const customersHandlers = [customersListSuccess, customersDetailSuccess];
