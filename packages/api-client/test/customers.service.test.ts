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
 * 1. the **resource filters** (`type`, `status`, `source`) actually travel in
 *    the URL — `toListQueryParams` used to drop them;
 * 2. the **pager block** is returned and a response without `meta.pagination` is
 *    a contract violation, not a silently missing field.
 */

import type { CustomerListQuery, ListQuery } from '@callback/shared';
import {
  CUSTOMERS_ACTIVITIES_PATH,
  CUSTOMERS_ACTIVITY_PATH,
  CUSTOMERS_AUDIT_LOGS_PATH,
  CUSTOMERS_CONTACTS_PATH,
  CUSTOMERS_CONTACT_PATH,
  CUSTOMERS_DETAIL_PATH,
  CUSTOMERS_PATH,
  CUSTOMERS_STATUS_PATH,
  CUSTOMERS_TAGS_PATH,
  CUSTOMERS_TAG_PATH,
  CUSTOMERS_USERS_PATH,
  CUSTOMERS_USER_PATH,
  clientPathOf,
  createCustomersService,
  toCustomerActivitiesPath,
  toCustomerActivityPath,
  toCustomerAuditLogsPath,
  toCustomerContactPath,
  toCustomerContactsPath,
  toCustomerDetailPath,
  toCustomerStatusPath,
  toCustomerTagPath,
  toCustomerTagsPath,
  toCustomerUserPath,
  toCustomerUsersPath,
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
  ACTIVATED_CUSTOMER_USER,
  INVITED_CUSTOMER_USER,
  RETURNED_ACTIVITY,
  RETURNED_TAG,
  UPDATED_CUSTOMER,
  VALID_ACTIVITY,
  VALID_ACTIVITY_LIST,
  VALID_ATTACH_TAG_INPUT,
  VALID_AUDIT_LOG_LIST,
  VALID_CONTACT,
  VALID_CONTACT_LIST,
  VALID_CREATE_ACTIVITY_INPUT,
  VALID_CREATE_CONTACT_INPUT,
  VALID_CREATE_INPUT,
  VALID_CREATE_TAG_INPUT,
  VALID_CUSTOMER,
  VALID_CUSTOMER_DETAIL,
  VALID_CUSTOMER_LIST,
  VALID_CUSTOMER_TAG,
  VALID_INVITE_USER_INPUT,
  VALID_UPDATE_ACTIVITY_INPUT,
  VALID_UPDATE_CONTACT_INPUT,
  VALID_UPDATE_INPUT,
  VALID_UPDATE_USER_INPUT,
} from './mocks/customer.mock.js';

const BASE_URL = 'http://api.test/api';

/** The query the contract defaults to, i.e. an “unchanged” list request. */
const DEFAULT_QUERY: CustomerListQuery = {
  page: 1,
  limit: 20,
  sort: 'createdAt',
  order: 'desc',
};

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

  it('sends the three resource filters (they used to be dropped)', async () => {
    const { service, fetchMock } = setup([paginatedResponse(VALID_CUSTOMER_LIST)]);

    await service.list({
      ...DEFAULT_QUERY,
      q: 'acme',
      type: 'company',
      status: 'active',
      source: 'referral',
    });

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers?q=acme&type=company&status=active` +
        `&source=referral`,
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

describe('the contact path constants (AIS-178, slice d)', () => {
  it('keep both placeholders on the collection and the item path', () => {
    expect(CUSTOMERS_CONTACTS_PATH).toBe('/admin/customers/:id/contacts');
    expect(CUSTOMERS_CONTACT_PATH).toBe(
      '/admin/customers/:id/contacts/:contactId',
    );
  });

  it('substitute and encode both ids', () => {
    expect(toCustomerContactsPath('a/b')).toBe('/admin/customers/a%2Fb/contacts');
    expect(toCustomerContactPath('customer', 'contact')).toBe(
      '/admin/customers/customer/contacts/contact',
    );
  });

  it('keep the registry parity of the four contact operations', () => {
    expect(clientPathOf('customers.listContacts')).toBe(CUSTOMERS_CONTACTS_PATH);
    expect(clientPathOf('customers.createContact')).toBe(CUSTOMERS_CONTACTS_PATH);
    expect(clientPathOf('customers.updateContact')).toBe(CUSTOMERS_CONTACT_PATH);
    expect(clientPathOf('customers.removeContact')).toBe(CUSTOMERS_CONTACT_PATH);
  });
});

describe('createCustomersService — listContacts', () => {
  const CONTACT_QUERY: ListQuery = { page: 1, limit: 20, order: 'desc' };

  it('calls GET /api/admin/customers/:id/contacts without a query when default', async () => {
    const { service, fetchMock } = setup([paginatedResponse(VALID_CONTACT_LIST)]);

    await service.listContacts(VALID_CUSTOMER.id, CONTACT_QUERY);

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/contacts`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('GET');
  });

  it('returns the contacts with the pager block', async () => {
    const { service } = setup([paginatedResponse(VALID_CONTACT_LIST)]);

    const result = await service.listContacts(VALID_CUSTOMER.id, CONTACT_QUERY);

    expect(result.data).toHaveLength(VALID_CONTACT_LIST.length);
    expect(result.meta.pagination.total).toBe(1);
  });

  it('surfaces an unknown customer as not found', async () => {
    const { service } = setup([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'No customer with that id was found.',
      }),
    ]);

    const error = await captureError(() =>
      service.listContacts(VALID_CUSTOMER.id, CONTACT_QUERY),
    );

    expect(isNotFoundError(error)).toBe(true);
  });
});

describe('createCustomersService — createContact', () => {
  it('posts the payload and parses the created contact', async () => {
    const { service, fetchMock } = setup([successResponse(VALID_CONTACT, 201)]);

    const created = await service.createContact(
      VALID_CUSTOMER.id,
      VALID_CREATE_CONTACT_INPUT,
    );

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/contacts`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('POST');
    expect(readBody(fetchMock.calls[0])).toEqual(VALID_CREATE_CONTACT_INPUT);
    expect(created.id).toBe(VALID_CONTACT.id);
  });

  it('keeps the primary-contact conflict code and its field detail', async () => {
    const { service } = setup([
      errorResponse({
        code: 'CUSTOMER_PRIMARY_CONTACT_CONFLICT',
        status: 409,
        message: 'Another contact is already the primary contact.',
        details: [
          {
            path: 'roles',
            message: 'Another contact is already the primary contact.',
          },
        ],
      }),
    ]);

    const error = await captureError(() =>
      service.createContact(VALID_CUSTOMER.id, VALID_CREATE_CONTACT_INPUT),
    );

    expect(error.code).toBe('CUSTOMER_PRIMARY_CONTACT_CONFLICT');
    expect(error.issues[0]?.path).toBe('roles');
  });

  it('keeps the 422 code for a login user of another customer', async () => {
    const { service } = setup([
      errorResponse({
        code: 'SEMANTIC_VALIDATION_FAILED',
        status: 422,
        message: 'Customer user does not belong to this customer.',
        details: [
          {
            path: 'customerUserId',
            message: 'Customer user does not belong to this customer.',
          },
        ],
      }),
    ]);

    const error = await captureError(() =>
      service.createContact(VALID_CUSTOMER.id, VALID_CREATE_CONTACT_INPUT),
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe('SEMANTIC_VALIDATION_FAILED');
    expect(error.issues[0]?.path).toBe('customerUserId');
  });
});

describe('createCustomersService — updateContact', () => {
  it('patches the contact route with the version token', async () => {
    const { service, fetchMock } = setup([successResponse(VALID_CONTACT)]);

    await service.updateContact(
      VALID_CUSTOMER.id,
      VALID_CONTACT.id,
      VALID_UPDATE_CONTACT_INPUT,
    );

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/contacts/${VALID_CONTACT.id}`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('PATCH');
    expect(readBody(fetchMock.calls[0])).toEqual(VALID_UPDATE_CONTACT_INPUT);
  });

  it('surfaces a stale token as 409 STALE_WRITE', async () => {
    const { service } = setup([
      errorResponse({
        code: 'STALE_WRITE',
        status: 409,
        message: 'The contact was updated by someone else.',
      }),
    ]);

    const error = await captureError(() =>
      service.updateContact(
        VALID_CUSTOMER.id,
        VALID_CONTACT.id,
        VALID_UPDATE_CONTACT_INPUT,
      ),
    );

    expect(error.code).toBe('STALE_WRITE');
  });
});

describe('createCustomersService — removeContact', () => {
  it('deletes the contact route and resolves the null payload', async () => {
    const { service, fetchMock } = setup([successResponse(null)]);

    const result = await service.removeContact(
      VALID_CUSTOMER.id,
      VALID_CONTACT.id,
    );

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/contacts/${VALID_CONTACT.id}`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('DELETE');
    expect(result).toBeNull();
  });

  it('treats a repeat delete as a 404', async () => {
    const { service } = setup([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'No contact with that id was found.',
      }),
    ]);

    const error = await captureError(() =>
      service.removeContact(VALID_CUSTOMER.id, VALID_CONTACT.id),
    );

    expect(isNotFoundError(error)).toBe(true);
  });
});

describe('the tag and customer-user paths (AIS-178, slice e)', () => {
  it('derives both tag routes from the registry', () => {
    expect(CUSTOMERS_TAGS_PATH).toBe('/admin/customers/:id/tags');
    expect(CUSTOMERS_TAG_PATH).toBe('/admin/customers/:id/tags/:tagId');
  });

  it('derives both customer-user routes from the registry', () => {
    expect(CUSTOMERS_USERS_PATH).toBe('/admin/customers/:id/customer-users');
    expect(CUSTOMERS_USER_PATH).toBe(
      '/admin/customers/:id/customer-users/:customerUserId',
    );
  });

  it('substitutes the tag ids and encodes them', () => {
    expect(toCustomerTagsPath(VALID_CUSTOMER.id)).toBe(
      `/admin/customers/${VALID_CUSTOMER.id}/tags`,
    );
    expect(toCustomerTagPath(VALID_CUSTOMER.id, VALID_CUSTOMER_TAG.id)).toBe(
      `/admin/customers/${VALID_CUSTOMER.id}/tags/${VALID_CUSTOMER_TAG.id}`,
    );
    expect(toCustomerTagPath('a/b', 'c/d')).toBe(
      '/admin/customers/a%2Fb/tags/c%2Fd',
    );
  });

  it('substitutes the customer-user ids and encodes them', () => {
    expect(toCustomerUsersPath(VALID_CUSTOMER.id)).toBe(
      `/admin/customers/${VALID_CUSTOMER.id}/customer-users`,
    );
    expect(
      toCustomerUserPath(VALID_CUSTOMER.id, INVITED_CUSTOMER_USER.id),
    ).toBe(
      `/admin/customers/${VALID_CUSTOMER.id}/customer-users/${INVITED_CUSTOMER_USER.id}`,
    );
  });
});

describe('createCustomersService — createTag', () => {
  it('posts the name and parses the attached label', async () => {
    const { service, fetchMock } = setup([successResponse(RETURNED_TAG, 201)]);

    const tag = await service.createTag(VALID_CUSTOMER.id, VALID_CREATE_TAG_INPUT);

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/tags`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('POST');
    expect(readBody(fetchMock.calls[0])).toEqual(VALID_CREATE_TAG_INPUT);
    expect(tag).toEqual(RETURNED_TAG);
  });

  it('answers the same payload for a repeated request (reused label)', async () => {
    // Two responses, because a `Response` body can only be read once.
    const { service } = setup([
      successResponse(RETURNED_TAG, 201),
      successResponse(RETURNED_TAG, 201),
    ]);

    const first = await service.createTag(VALID_CUSTOMER.id, VALID_CREATE_TAG_INPUT);
    const second = await service.createTag(VALID_CUSTOMER.id, VALID_CREATE_TAG_INPUT);

    expect(second).toEqual(first);
  });

  it('surfaces an unknown customer as not found', async () => {
    const { service } = setup([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'No customer with that id was found.',
      }),
    ]);

    const error = await captureError(() =>
      service.createTag(VALID_CUSTOMER.id, VALID_CREATE_TAG_INPUT),
    );

    expect(isNotFoundError(error)).toBe(true);
  });
});

describe('createCustomersService — attachTag', () => {
  it('patches the tag collection with the label id', async () => {
    const { service, fetchMock } = setup([successResponse(RETURNED_TAG)]);

    await service.attachTag(VALID_CUSTOMER.id, VALID_ATTACH_TAG_INPUT);

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/tags`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('PATCH');
    expect(readBody(fetchMock.calls[0])).toEqual(VALID_ATTACH_TAG_INPUT);
  });

  it('keeps the 422 code for an unknown or inactive label', async () => {
    const { service } = setup([
      errorResponse({
        code: 'SEMANTIC_VALIDATION_FAILED',
        status: 422,
        message: 'No tag with that id exists in the catalogue.',
        details: [
          { path: 'tagId', message: 'No tag with that id exists in the catalogue.' },
        ],
      }),
    ]);

    const error = await captureError(() =>
      service.attachTag(VALID_CUSTOMER.id, VALID_ATTACH_TAG_INPUT),
    );

    expect(error.status).toBe(422);
    expect(error.issues[0]?.path).toBe('tagId');
  });
});

describe('createCustomersService — detachTag', () => {
  it('deletes the tag link and resolves the null payload', async () => {
    const { service, fetchMock } = setup([successResponse(null)]);

    const result = await service.detachTag(VALID_CUSTOMER.id, VALID_CUSTOMER_TAG.id);

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/tags/${VALID_CUSTOMER_TAG.id}`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('DELETE');
    expect(result).toBeNull();
  });

  it('treats a repeat detach as a 404', async () => {
    const { service } = setup([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'The tag is not attached to this customer.',
      }),
    ]);

    const error = await captureError(() =>
      service.detachTag(VALID_CUSTOMER.id, VALID_CUSTOMER_TAG.id),
    );

    expect(isNotFoundError(error)).toBe(true);
  });
});

describe('createCustomersService — inviteCustomerUser', () => {
  it('posts the invitation and parses the invited row', async () => {
    const { service, fetchMock } = setup([
      successResponse(INVITED_CUSTOMER_USER, 201),
    ]);

    const invited = await service.inviteCustomerUser(
      VALID_CUSTOMER.id,
      VALID_INVITE_USER_INPUT,
    );

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/customer-users`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('POST');
    expect(readBody(fetchMock.calls[0])).toEqual(VALID_INVITE_USER_INPUT);
    expect(invited.status).toBe('invited');
    expect(invited.invitedAt).toBe(INVITED_CUSTOMER_USER.invitedAt);
  });

  it('keeps the e-mail conflict code and its field detail', async () => {
    const { service } = setup([
      errorResponse({
        code: 'CUSTOMER_USER_EMAIL_CONFLICT',
        status: 409,
        message: 'A customer user with this e-mail already exists.',
        details: [
          {
            path: 'email',
            message: 'A customer user with this e-mail already exists.',
          },
        ],
      }),
    ]);

    const error = await captureError(() =>
      service.inviteCustomerUser(VALID_CUSTOMER.id, VALID_INVITE_USER_INPUT),
    );

    expect(error.code).toBe('CUSTOMER_USER_EMAIL_CONFLICT');
    expect(error.issues[0]?.path).toBe('email');
  });
});

describe('createCustomersService — updateCustomerUser', () => {
  it('patches the user route with the version token', async () => {
    const { service, fetchMock } = setup([
      successResponse(ACTIVATED_CUSTOMER_USER),
    ]);

    const updated = await service.updateCustomerUser(
      VALID_CUSTOMER.id,
      INVITED_CUSTOMER_USER.id,
      VALID_UPDATE_USER_INPUT,
    );

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/customer-users/${INVITED_CUSTOMER_USER.id}`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('PATCH');
    expect(readBody(fetchMock.calls[0])).toEqual(VALID_UPDATE_USER_INPUT);
    expect(updated.status).toBe('active');
  });

  it('keeps the owner conflict code and its field detail', async () => {
    const { service } = setup([
      errorResponse({
        code: 'CUSTOMER_OWNER_CONFLICT',
        status: 409,
        message: 'This customer already has an active owner.',
        details: [
          { path: 'role', message: 'This customer already has an active owner.' },
        ],
      }),
    ]);

    const error = await captureError(() =>
      service.updateCustomerUser(
        VALID_CUSTOMER.id,
        INVITED_CUSTOMER_USER.id,
        VALID_UPDATE_USER_INPUT,
      ),
    );

    expect(error.code).toBe('CUSTOMER_OWNER_CONFLICT');
    expect(error.issues[0]?.path).toBe('role');
  });
});

describe('createCustomersService — removeCustomerUser', () => {
  it('deletes the user route and resolves the null payload', async () => {
    const { service, fetchMock } = setup([successResponse(null)]);

    const result = await service.removeCustomerUser(
      VALID_CUSTOMER.id,
      INVITED_CUSTOMER_USER.id,
    );

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/customer-users/${INVITED_CUSTOMER_USER.id}`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('DELETE');
    expect(result).toBeNull();
  });

  it('keeps the 422 code for an activated user', async () => {
    const { service } = setup([
      errorResponse({
        code: 'SEMANTIC_VALIDATION_FAILED',
        status: 422,
        message: 'Only a pending invitation can be revoked.',
        details: [
          { path: 'status', message: 'Only a pending invitation can be revoked.' },
        ],
      }),
    ]);

    const error = await captureError(() =>
      service.removeCustomerUser(VALID_CUSTOMER.id, INVITED_CUSTOMER_USER.id),
    );

    expect(error.status).toBe(422);
    expect(error.issues[0]?.path).toBe('status');
  });
});

describe('the activity and audit-log paths (AIS-178, slice f)', () => {
  it('derive the feed and the single-activity routes from the registry', () => {
    expect(clientPathOf('customers.listActivities')).toBe(
      CUSTOMERS_ACTIVITIES_PATH,
    );
    expect(clientPathOf('customers.createActivity')).toBe(
      CUSTOMERS_ACTIVITIES_PATH,
    );
    expect(clientPathOf('customers.updateActivity')).toBe(
      CUSTOMERS_ACTIVITY_PATH,
    );
    expect(clientPathOf('customers.removeActivity')).toBe(
      CUSTOMERS_ACTIVITY_PATH,
    );
  });

  it('derive the audit-log route from the registry', () => {
    expect(clientPathOf('customers.listAuditLogs')).toBe(
      CUSTOMERS_AUDIT_LOGS_PATH,
    );
  });

  it('substitute and encode both ids', () => {
    expect(toCustomerActivitiesPath('a/b')).toBe(
      '/admin/customers/a%2Fb/activities',
    );
    expect(toCustomerActivityPath('customer', 'activity')).toBe(
      '/admin/customers/customer/activities/activity',
    );
    expect(toCustomerAuditLogsPath('a/b')).toBe(
      '/admin/customers/a%2Fb/audit-logs',
    );
  });
});

describe('createCustomersService — listActivities', () => {
  const ACTIVITY_QUERY = { page: 1, limit: 20, order: 'desc' } as const;

  it('calls GET …/activities without a query when everything is default', async () => {
    const { service, fetchMock } = setup([
      paginatedResponse(VALID_ACTIVITY_LIST),
    ]);

    await service.listActivities(VALID_CUSTOMER.id, ACTIVITY_QUERY);

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/activities`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('GET');
  });

  it('encodes only the paging fields the caller changed', async () => {
    const { service, fetchMock } = setup([
      paginatedResponse(VALID_ACTIVITY_LIST),
    ]);

    await service.listActivities(VALID_CUSTOMER.id, {
      page: 2,
      limit: 5,
      order: 'asc',
    });

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/activities?page=2&limit=5&order=asc`,
    );
  });

  it('returns the feed with the pager block', async () => {
    const { service } = setup([paginatedResponse(VALID_ACTIVITY_LIST)]);

    const result = await service.listActivities(
      VALID_CUSTOMER.id,
      ACTIVITY_QUERY,
    );

    expect(result.data).toHaveLength(VALID_ACTIVITY_LIST.length);
    expect(result.data[0]?.id).toBe(VALID_ACTIVITY.id);
    expect(result.meta.pagination.total).toBe(1);
  });

  it('surfaces an unknown customer as not found', async () => {
    const { service } = setup([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'No customer with that id was found.',
      }),
    ]);

    const error = await captureError(() =>
      service.listActivities(VALID_CUSTOMER.id, ACTIVITY_QUERY),
    );

    expect(isNotFoundError(error)).toBe(true);
  });
});

describe('createCustomersService — createActivity', () => {
  it('posts the payload and parses the created entry', async () => {
    const { service, fetchMock } = setup([
      successResponse(RETURNED_ACTIVITY, 201),
    ]);

    const created = await service.createActivity(
      VALID_CUSTOMER.id,
      VALID_CREATE_ACTIVITY_INPUT,
    );

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/activities`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('POST');
    expect(readBody(fetchMock.calls[0])).toEqual(VALID_CREATE_ACTIVITY_INPUT);
    expect(created.id).toBe(VALID_ACTIVITY.id);
  });

  it('never sends an author with the body', async () => {
    const { service, fetchMock } = setup([successResponse(RETURNED_ACTIVITY, 201)]);

    await service.createActivity(VALID_CUSTOMER.id, VALID_CREATE_ACTIVITY_INPUT);

    expect(readBody(fetchMock.calls[0])).not.toHaveProperty('authorType');
    expect(readBody(fetchMock.calls[0])).not.toHaveProperty('authorName');
  });

  it('surfaces an unknown customer as not found', async () => {
    const { service } = setup([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'No customer with that id was found.',
      }),
    ]);

    const error = await captureError(() =>
      service.createActivity(VALID_CUSTOMER.id, VALID_CREATE_ACTIVITY_INPUT),
    );

    expect(error.status).toBe(404);
  });
});

describe('createCustomersService — updateActivity', () => {
  it('patches the entry route with the last write instant', async () => {
    const { service, fetchMock } = setup([successResponse(RETURNED_ACTIVITY)]);

    const updated = await service.updateActivity(
      VALID_CUSTOMER.id,
      VALID_ACTIVITY.id,
      VALID_UPDATE_ACTIVITY_INPUT,
    );

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/activities/${VALID_ACTIVITY.id}`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('PATCH');
    expect(readBody(fetchMock.calls[0])).toEqual(VALID_UPDATE_ACTIVITY_INPUT);
    expect(updated.updatedAt).toBe(VALID_ACTIVITY.updatedAt);
  });

  it('surfaces a stale token as 409 STALE_WRITE', async () => {
    const { service } = setup([
      errorResponse({
        code: 'STALE_WRITE',
        status: 409,
        message: 'The activity was updated by someone else.',
      }),
    ]);

    const error = await captureError(() =>
      service.updateActivity(
        VALID_CUSTOMER.id,
        VALID_ACTIVITY.id,
        VALID_UPDATE_ACTIVITY_INPUT,
      ),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe('STALE_WRITE');
  });
});

describe('createCustomersService — removeActivity', () => {
  it('deletes the entry route and resolves the null payload', async () => {
    const { service, fetchMock } = setup([successResponse(null)]);

    const result = await service.removeActivity(
      VALID_CUSTOMER.id,
      VALID_ACTIVITY.id,
    );

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/activities/${VALID_ACTIVITY.id}`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('DELETE');
    expect(result).toBeNull();
  });

  it('treats a repeat delete as a 404', async () => {
    const { service } = setup([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'No activity with that id was found.',
      }),
    ]);

    const error = await captureError(() =>
      service.removeActivity(VALID_CUSTOMER.id, VALID_ACTIVITY.id),
    );

    expect(isNotFoundError(error)).toBe(true);
  });
});

describe('createCustomersService — listAuditLogs', () => {
  const AUDIT_QUERY = { page: 1, limit: 20, order: 'desc' } as const;

  it('calls GET …/audit-logs without a query when no filter is set', async () => {
    const { service, fetchMock } = setup([
      paginatedResponse(VALID_AUDIT_LOG_LIST),
    ]);

    await service.listAuditLogs(VALID_CUSTOMER.id, AUDIT_QUERY);

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/admin/customers/${VALID_CUSTOMER.id}/audit-logs`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('GET');
  });

  it('sends the four filters', async () => {
    const { service, fetchMock } = setup([
      paginatedResponse(VALID_AUDIT_LOG_LIST),
    ]);
    const actorId = '6b7c8d9e-0f1a-4b2c-8d3e-5f6a7b8c9d0e';

    await service.listAuditLogs(VALID_CUSTOMER.id, {
      ...AUDIT_QUERY,
      tableName: 'customers',
      operation: 'update',
      actorId,
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-30T23:59:59.000Z',
    });

    const url = fetchMock.calls[0]?.url ?? '';

    expect(url).toContain('tableName=customers');
    expect(url).toContain('operation=update');
    expect(url).toContain(`actorId=${actorId}`);
    expect(url).toContain('from=2026-11-01T00%3A00%3A00.000Z');
    expect(url).toContain('to=2026-11-30T23%3A59%3A59.000Z');
  });

  it('returns the ledger rows with the pager block', async () => {
    const { service } = setup([paginatedResponse(VALID_AUDIT_LOG_LIST)]);

    const result = await service.listAuditLogs(
      VALID_CUSTOMER.id,
      AUDIT_QUERY,
    );

    expect(result.data).toHaveLength(VALID_AUDIT_LOG_LIST.length);
    expect(result.data[0]?.id).toBe(VALID_AUDIT_LOG_LIST[0]?.id);
    expect(result.meta.pagination.total).toBe(1);
  });

  it('keeps the 422 code of an inverted window', async () => {
    const { service } = setup([
      errorResponse({
        code: 'SEMANTIC_VALIDATION_FAILED',
        status: 422,
        message: 'The requested time window ends before it starts.',
        details: [
          {
            path: 'from',
            message: 'The "from" bound must not be later than the "to" bound.',
          },
        ],
      }),
    ]);

    const error = await captureError(() =>
      service.listAuditLogs(VALID_CUSTOMER.id, AUDIT_QUERY),
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe('SEMANTIC_VALIDATION_FAILED');
    expect(error.issues[0]?.path).toBe('from');
  });
});
