/**
 * Unit tests for `src/customers/customers.service.ts` (AIS-178/c).
 *
 * The transport is real, only `fetch` is doubled: this way the test proves the
 * whole chain — URL, method, body, and the zod parse of the response — instead
 * of asserting that one function called another.
 *
 * Two things are asserted on every list call, because both were defects before
 * this slice:
 *
 * 1. the **resource filters** (`type`, `status`, `source`,
 *    `responsibleOperatorId`) actually travel in the URL — `toListQueryParams`
 *    used to drop them;
 * 2. the **pager block** is returned and a response without `meta.pagination` is
 *    a contract violation, not a silently missing field.
 */

import type { CustomerListQuery } from '@callback/shared';
import {
  CUSTOMERS_DETAIL_PATH,
  CUSTOMERS_PATH,
  CUSTOMERS_STATUS_PATH,
  clientPathOf,
  createCustomersService,
  toCustomerDetailPath,
  toCustomerStatusPath,
  UNEXPECTED_PAYLOAD_CODE,
} from '../src/index.js';
import { ApiError, isNotFoundError } from '../src/api-error.js';
import { createHttpClient } from '../src/http-client.js';
import type { RecordedCall } from './mocks/fetch.mock.js';
import {
  createSequenceFetchMock,
  errorResponse,
  paginatedResponse,
  successResponse,
} from './mocks/fetch.mock.js';
import {
  UPDATED_CUSTOMER,
  VALID_CREATE_INPUT,
  VALID_CUSTOMER,
  VALID_CUSTOMER_DETAIL,
  VALID_CUSTOMER_LIST,
  VALID_UPDATE_INPUT,
} from './mocks/customer.mock.js';

const BASE_URL = 'http://api.test/api';

/** The query the contract defaults to, i.e. an “unchanged” list request. */
const DEFAULT_QUERY: CustomerListQuery = {
  page: 1,
  limit: 20,
  sort: 'createdAt',
  order: 'desc',
};

/** The operator id a filter can carry; any uuid is valid. */
const OPERATOR_ID = 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e';

/**
 * Builds the service over a doubled `fetch`.
 *
 * @param responses - responses to return, in call order.
 */
function setup(responses: readonly Response[]) {
  const fetchMock = createSequenceFetchMock(responses);
  const client = createHttpClient({
    baseUrl: BASE_URL,
    fetchImpl: fetchMock.fetchImpl,
  });

  return { service: createCustomersService(client), fetchMock };
}

/** Reads the JSON body out of a recorded call. */
function readBody(call: RecordedCall | undefined): unknown {
  const body = call?.init?.body;

  if (typeof body !== 'string') {
    throw new Error('expected a string body on the recorded call');
  }

  return JSON.parse(body) as unknown;
}

/**
 * @param run - a call expected to throw.
 * @returns the `ApiError` it threw, so the test can assert on its fields.
 */
async function captureError(run: () => Promise<unknown>): Promise<ApiError> {
  try {
    await run();
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return error;
    }

    throw error;
  }

  throw new Error('expected the call to throw');
}

describe('the customers path constants (AIS-178/c)', () => {
  it('are relative to the injected /api base URL', () => {
    expect(CUSTOMERS_PATH).toBe('/admin/customers');
  });

  it('keep the id placeholder on the detail path', () => {
    expect(CUSTOMERS_DETAIL_PATH).toBe('/admin/customers/:id');
  });

  it('keep the id placeholder on the status path', () => {
    expect(CUSTOMERS_STATUS_PATH).toBe('/admin/customers/:id/status');
  });
});

describe('detail-path parity (AIS-178/c)', () => {
  it('serves findById, update and remove from the same route', () => {
    expect(clientPathOf('customers.findById')).toBe(CUSTOMERS_DETAIL_PATH);
    expect(clientPathOf('customers.update')).toBe(CUSTOMERS_DETAIL_PATH);
    expect(clientPathOf('customers.remove')).toBe(CUSTOMERS_DETAIL_PATH);
  });

  it('serves the collection from the list route', () => {
    expect(clientPathOf('customers.list')).toBe(CUSTOMERS_PATH);
    expect(clientPathOf('customers.create')).toBe(CUSTOMERS_PATH);
  });

  it('serves the status change from its own route', () => {
    expect(clientPathOf('customers.updateStatus')).toBe(CUSTOMERS_STATUS_PATH);
  });
});

describe('toCustomerDetailPath / toCustomerStatusPath', () => {
  it('substitutes the id into the detail path', () => {
    expect(toCustomerDetailPath(VALID_CUSTOMER.id)).toBe(
      `/admin/customers/${VALID_CUSTOMER.id}`,
    );
  });

  it('substitutes the id into the status path', () => {
    expect(toCustomerStatusPath(VALID_CUSTOMER.id)).toBe(
      `/admin/customers/${VALID_CUSTOMER.id}/status`,
    );
  });

  it('URL-encodes the id, so a bad value can only produce a 404', () => {
    expect(toCustomerDetailPath('a/b')).toBe('/admin/customers/a%2Fb');
  });
});

describe('createCustomersService — list', () => {
  it('calls GET /api/admin/customers without a query string when everything is default', async () => {
    const { service, fetchMock } = setup([paginatedResponse(VALID_CUSTOMER_LIST)]);

    await service.list(DEFAULT_QUERY);

    expect(fetchMock.calls[0]?.url).toBe(`${BASE_URL}/admin/customers`);
    expect(fetchMock.calls[0]?.init?.method).toBe('GET');
  });

  it('encodes the paging fields the caller actually changed', async () => {
    const { service, fetchMock } = setup([paginatedResponse(VALID_CUSTOMER_LIST)]);

    await service.list({
      page: 2,
      limit: 50,
      sort: 'legalName',
      order: 'asc',
    });

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers?page=2&limit=50&order=asc&sort=legalName`,
    );
  });

  it('sends the four resource filters (they used to be dropped)', async () => {
    const { service, fetchMock } = setup([paginatedResponse(VALID_CUSTOMER_LIST)]);

    await service.list({
      ...DEFAULT_QUERY,
      q: 'acme',
      type: 'company',
      status: 'active',
      source: 'referral',
      responsibleOperatorId: OPERATOR_ID,
    });

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers?q=acme&type=company&status=active` +
        `&source=referral&responsibleOperatorId=${OPERATOR_ID}`,
    );
  });

  it('returns the rows together with meta.pagination', async () => {
    const { service } = setup([paginatedResponse(VALID_CUSTOMER_LIST)]);

    const result = await service.list(DEFAULT_QUERY);

    expect(result.data).toEqual(VALID_CUSTOMER_LIST);
    expect(result.meta.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('rejects a page response that carries no pager block', async () => {
    const { service } = setup([successResponse(VALID_CUSTOMER_LIST)]);

    const error = await captureError(() => service.list(DEFAULT_QUERY));

    expect(error.code).toBe(UNEXPECTED_PAYLOAD_CODE);
  });
});

describe('createCustomersService — findById', () => {
  it('calls GET /api/admin/customers/:id and parses the detail', async () => {
    const { service, fetchMock } = setup([successResponse(VALID_CUSTOMER_DETAIL)]);

    const detail = await service.findById(VALID_CUSTOMER.id);

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}`,
    );
    expect(detail.tags).toHaveLength(VALID_CUSTOMER_DETAIL.tags.length);
    expect(detail.contacts).toHaveLength(VALID_CUSTOMER_DETAIL.contacts.length);
  });

  it('surfaces a 404 as a not-found ApiError', async () => {
    const { service } = setup([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'No customer with that id was found.',
      }),
    ]);

    const error = await captureError(() => service.findById(VALID_CUSTOMER.id));

    expect(isNotFoundError(error)).toBe(true);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('rejects a response whose payload drifted from the contract', async () => {
    const { service } = setup([
      successResponse({ ...VALID_CUSTOMER_DETAIL, customerNumber: undefined }),
    ]);

    const error = await captureError(() => service.findById(VALID_CUSTOMER.id));

    expect(error.code).toBe(UNEXPECTED_PAYLOAD_CODE);
  });
});

describe('createCustomersService — create', () => {
  it('posts the payload and parses the created customer', async () => {
    const { service, fetchMock } = setup([successResponse(VALID_CUSTOMER, 201)]);

    const created = await service.create(VALID_CREATE_INPUT);

    expect(fetchMock.calls[0]?.url).toBe(`${BASE_URL}/admin/customers`);
    expect(fetchMock.calls[0]?.init?.method).toBe('POST');
    expect(readBody(fetchMock.calls[0])).toEqual(VALID_CREATE_INPUT);
    expect(created.customerNumber).toBe(VALID_CUSTOMER.customerNumber);
  });

  it('keeps the tax-number conflict code and its field detail', async () => {
    const { service } = setup([
      errorResponse({
        code: 'CUSTOMER_TAX_NUMBER_CONFLICT',
        status: 409,
        message: 'This tax number is already used by another customer.',
        details: [
          {
            path: 'taxNumber',
            message: 'This tax number is already used by another customer.',
          },
        ],
      }),
    ]);

    const error = await captureError(() => service.create(VALID_CREATE_INPUT));

    expect(error.status).toBe(409);
    expect(error.code).toBe('CUSTOMER_TAX_NUMBER_CONFLICT');
    expect(error.issues[0]?.path).toBe('taxNumber');
  });
});

describe('createCustomersService — update', () => {
  it('patches the detail route with the version token', async () => {
    const { service, fetchMock } = setup([successResponse(UPDATED_CUSTOMER)]);

    const updated = await service.update(VALID_CUSTOMER.id, VALID_UPDATE_INPUT);

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('PATCH');
    expect(readBody(fetchMock.calls[0])).toEqual(VALID_UPDATE_INPUT);
    expect(updated.updatedAt).toBe(UPDATED_CUSTOMER.updatedAt);
  });

  it('surfaces a stale version as 409 STALE_WRITE', async () => {
    const { service } = setup([
      errorResponse({
        code: 'STALE_WRITE',
        status: 409,
        message: 'The customer was updated by someone else.',
        details: [{ path: 'updatedAt', message: 'Outdated version token.' }],
      }),
    ]);

    const error = await captureError(() =>
      service.update(VALID_CUSTOMER.id, VALID_UPDATE_INPUT),
    );

    expect(error.code).toBe('STALE_WRITE');
    expect(error.issues[0]?.path).toBe('updatedAt');
  });
});

describe('createCustomersService — updateStatus', () => {
  it('patches the dedicated status route, not the general one', async () => {
    const { service, fetchMock } = setup([
      successResponse({ ...VALID_CUSTOMER, status: 'suspended' }),
    ]);

    const updated = await service.updateStatus(VALID_CUSTOMER.id, {
      status: 'suspended',
      updatedAt: VALID_CUSTOMER.updatedAt,
    });

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/status`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('PATCH');
    expect(updated.status).toBe('suspended');
  });
});

describe('createCustomersService — remove', () => {
  it('deletes the detail route and resolves the null payload', async () => {
    const { service, fetchMock } = setup([successResponse(null)]);

    const result = await service.remove(VALID_CUSTOMER.id);

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('DELETE');
    expect(result).toBeNull();
  });

  it('rejects a non-null success payload', async () => {
    const { service } = setup([successResponse({ id: VALID_CUSTOMER.id })]);

    const error = await captureError(() => service.remove(VALID_CUSTOMER.id));

    expect(error.code).toBe(UNEXPECTED_PAYLOAD_CODE);
  });

  it('treats a repeat delete as a 404', async () => {
    const { service } = setup([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'No customer with that id was found.',
      }),
    ]);

    const error = await captureError(() => service.remove(VALID_CUSTOMER.id));

    expect(isNotFoundError(error)).toBe(true);
  });
});

describe('createCustomersService — request options', () => {
  it('forwards the abort signal to fetch', async () => {
    const controller = new AbortController();
    const { service, fetchMock } = setup([paginatedResponse(VALID_CUSTOMER_LIST)]);

    await service.list(DEFAULT_QUERY, { signal: controller.signal });

    expect(fetchMock.calls[0]?.init?.signal).toBe(controller.signal);
  });
});
