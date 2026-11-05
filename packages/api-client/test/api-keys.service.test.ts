/**
 * Unit tests for `src/api-keys/api-keys.service.ts`.
 *
 * The transport is real, only `fetch` is doubled: this way the test proves the
 * whole chain — URL, method, body, and the zod parse of the response — instead
 * of asserting that one function called another.
 *
 * Since AIS-114 the list read is a **paginated** call: `getList` unwraps the
 * envelope, validates `meta.pagination` and returns the shared `ApiResult`. The
 * tests therefore assert the pager block too, and that a response without it is a
 * contract violation rather than a silently missing field.
 */

import type { ApiKeyListQuery } from '@callback/shared';
import {
  API_KEYS_DETAIL_PATH,
  API_KEYS_PATH,
  clientPathOf,
  createApiKeysService,
  toApiKeyDetailPath,
  UNEXPECTED_PAYLOAD_CODE,
} from '../src/index.js';
import { ApiError, isConflict } from '../src/api-error.js';
import { createHttpClient } from '../src/http-client.js';
import type { RecordedCall } from './mocks/fetch.mock.js';
import {
  createSequenceFetchMock,
  emptyResponse,
  errorResponse,
  paginatedResponse,
  successResponse,
} from './mocks/fetch.mock.js';
import {
  SECOND_API_KEY,
  UPDATED_API_KEY,
  VALID_API_KEY,
  VALID_API_KEY_LIST,
  VALID_CREATE_INPUT,
  VALID_UPDATE_INPUT,
} from './mocks/api-key.mock.js';

const BASE_URL = 'http://api.test/api';

/** The query the contract defaults to, i.e. an “unchanged” list request. */
const DEFAULT_QUERY: ApiKeyListQuery = {
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

  return { service: createApiKeysService(client), fetchMock };
}

/** Reads the JSON body out of a recorded call. */
function readBody(call: RecordedCall | undefined): unknown {
  const body = call?.init?.body;

  if (typeof body !== 'string') {
    throw new Error('expected a string body on the recorded call');
  }

  return JSON.parse(body) as unknown;
}

describe('API_KEYS_PATH', () => {
  it('is relative to the injected /api base URL', () => {
    expect(API_KEYS_PATH).toBe('/api-keys');
  });

  it('keeps the identifier placeholder on the detail path', () => {
    expect(API_KEYS_DETAIL_PATH).toBe('/api-keys/:identifier');
  });
});

describe('detail path parity (AIS-110)', () => {
  it('serves findByIdentifier, update and remove from the same route', () => {
    expect(clientPathOf('apiKeys.update')).toBe(API_KEYS_DETAIL_PATH);
    expect(clientPathOf('apiKeys.remove')).toBe(API_KEYS_DETAIL_PATH);
  });
});

describe('createApiKeysService — list', () => {
  it('calls GET /api/api-keys without a query string when everything is default', async () => {
    const { service, fetchMock } = setup([
      paginatedResponse(VALID_API_KEY_LIST),
    ]);

    await service.list(DEFAULT_QUERY);

    expect(fetchMock.calls[0]?.url).toBe(`${BASE_URL}/api-keys`);
    expect(fetchMock.calls[0]?.init?.method).toBe('GET');
  });

  it('encodes only the fields the caller actually changed', async () => {
    const { service, fetchMock } = setup([
      paginatedResponse(VALID_API_KEY_LIST),
    ]);

    await service.list({
      page: 2,
      limit: 50,
      sort: 'name',
      order: 'asc',
    });

    const url = fetchMock.calls[0]?.url ?? '';

    expect(url).toContain('page=2');
    expect(url).toContain('limit=50');
    expect(url).toContain('sort=name');
    expect(url).toContain('order=asc');
  });

  it('returns the rows in order together with meta.pagination', async () => {
    const { service } = setup([
      paginatedResponse(VALID_API_KEY_LIST, { total: 2, totalPages: 1 }),
    ]);

    const result = await service.list(DEFAULT_QUERY);

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.identifier).toBe(VALID_API_KEY.identifier);
    expect(result.data[1]?.identifier).toBe(SECOND_API_KEY.identifier);
    expect(result.meta.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
    expect(result.meta.requestId).toBeTruthy();
  });

  it('reports an empty page as an empty array with total 0', async () => {
    const { service } = setup([
      paginatedResponse([], { total: 0, totalPages: 0 }),
    ]);

    const result = await service.list(DEFAULT_QUERY);

    expect(result.data).toEqual([]);
    expect(result.meta.pagination.total).toBe(0);
    expect(result.meta.pagination.totalPages).toBe(0);
  });

  it('rejects a malformed row instead of returning a half-typed object', async () => {
    const { service } = setup([
      paginatedResponse([{ ...VALID_API_KEY, expiresAt: '2027-01-31' }]),
    ]);

    await expect(service.list(DEFAULT_QUERY)).rejects.toMatchObject({
      name: 'ApiError',
    });
  });

  it('rejects a list response without meta.pagination', async () => {
    const { service } = setup([successResponse(VALID_API_KEY_LIST)]);

    const error = await service
      .list(DEFAULT_QUERY)
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(UNEXPECTED_PAYLOAD_CODE);
    expect((error as ApiError).issues.map((issue) => issue.path)).toContain(
      'meta.pagination',
    );
  });
});

describe('createApiKeysService — findByIdentifier', () => {
  it('substitutes the identifier into the detail path', async () => {
    const { service, fetchMock } = setup([successResponse(VALID_API_KEY)]);

    const result = await service.findByIdentifier(VALID_API_KEY.identifier);

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/api-keys/${VALID_API_KEY.identifier}`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('GET');
    expect(result.id).toBe(VALID_API_KEY.id);
  });

  it('URL-encodes an identifier that carries a reserved character', async () => {
    const { service, fetchMock } = setup([successResponse(VALID_API_KEY)]);

    await service.findByIdentifier('a/b');

    expect(fetchMock.calls[0]?.url).toBe(`${BASE_URL}/api-keys/a%2Fb`);
  });

  it('surfaces a missing resource as a coded 404', async () => {
    const { service } = setup([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'API key "ghost" was not found',
      }),
    ]);

    const error = await service
      .findByIdentifier('ghost')
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).code).toBe('NOT_FOUND');
  });
});

describe('toApiKeyDetailPath', () => {
  it('replaces the registry placeholder', () => {
    expect(toApiKeyDetailPath('vapi-prod')).toBe('/api-keys/vapi-prod');
  });

  it('never leaves the placeholder in place', () => {
    expect(toApiKeyDetailPath('vapi-prod')).not.toContain(':identifier');
  });
});

describe('createApiKeysService — create', () => {
  it('posts the payload unchanged and returns the created key', async () => {
    const { service, fetchMock } = setup([successResponse(VALID_API_KEY, 201)]);

    const result = await service.create(VALID_CREATE_INPUT);

    expect(fetchMock.calls[0]?.url).toBe(`${BASE_URL}/api-keys`);
    expect(fetchMock.calls[0]?.init?.method).toBe('POST');
    expect(readBody(fetchMock.calls[0])).toEqual(VALID_CREATE_INPUT);
    expect(result.id).toBe(VALID_API_KEY.id);
  });

  it('does not invent optional fields when the caller omitted them', async () => {
    const { service, fetchMock } = setup([successResponse(VALID_API_KEY, 201)]);

    await service.create(VALID_CREATE_INPUT);

    const body = readBody(fetchMock.calls[0]) as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual(['apiKey', 'identifier', 'name']);
  });

  it('sends the optional fields when they are present', async () => {
    const { service, fetchMock } = setup([successResponse(VALID_API_KEY, 201)]);

    await service.create({
      ...VALID_CREATE_INPUT,
      description: 'staging token',
      expiresAt: '2027-01-31T23:00:00.000Z',
    });

    expect(readBody(fetchMock.calls[0])).toMatchObject({
      description: 'staging token',
      expiresAt: '2027-01-31T23:00:00.000Z',
    });
  });

  it('surfaces a duplicate identifier as a coded 409 conflict', async () => {
    const { service } = setup([
      errorResponse({
        code: 'API_KEY_IDENTIFIER_CONFLICT',
        status: 409,
        message: 'identifier already exists',
        details: [{ path: 'identifier', message: 'already taken' }],
      }),
    ]);

    const error = await service
      .create(VALID_CREATE_INPUT)
      .catch((e: unknown) => e);

    expect(isConflict(error)).toBe(true);
    expect((error as ApiError).code).toBe('API_KEY_IDENTIFIER_CONFLICT');
    expect((error as ApiError).issues[0]?.path).toBe('identifier');
  });

  it('surfaces a validation failure with field issues', async () => {
    const { service } = setup([
      errorResponse({
        code: 'VALIDATION_FAILED',
        status: 400,
        message: 'The request payload does not match the API contract.',
        details: [{ path: 'identifier', message: 'must be URL-safe' }],
      }),
    ]);

    const error = await service
      .create(VALID_CREATE_INPUT)
      .catch((e: unknown) => e);

    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).code).toBe('VALIDATION_FAILED');
    expect((error as ApiError).details).toEqual([
      'identifier: must be URL-safe',
    ]);
  });
});

describe('createApiKeysService — update (AIS-110)', () => {
  it('PATCHes the identified row with the payload unchanged', async () => {
    const { service, fetchMock } = setup([successResponse(UPDATED_API_KEY)]);

    const result = await service.update(
      VALID_API_KEY.identifier,
      VALID_UPDATE_INPUT,
    );

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/api-keys/${VALID_API_KEY.identifier}`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('PATCH');
    expect(readBody(fetchMock.calls[0])).toEqual(VALID_UPDATE_INPUT);
    expect(result.updatedAt).toBe(UPDATED_API_KEY.updatedAt);
    expect(result.name).toBe(UPDATED_API_KEY.name);
  });

  it('sends the required updatedAt concurrency token', async () => {
    const { service, fetchMock } = setup([successResponse(UPDATED_API_KEY)]);

    await service.update(VALID_API_KEY.identifier, VALID_UPDATE_INPUT);

    const body = readBody(fetchMock.calls[0]) as Record<string, unknown>;

    expect(body.updatedAt).toBe(VALID_API_KEY.updatedAt);
  });

  it('keeps an explicit null instead of dropping the key', async () => {
    const { service, fetchMock } = setup([successResponse(UPDATED_API_KEY)]);

    await service.update(VALID_API_KEY.identifier, VALID_UPDATE_INPUT);

    const body = readBody(fetchMock.calls[0]) as Record<string, unknown>;

    expect(Object.hasOwn(body, 'description')).toBe(true);
    expect(body.description).toBeNull();
  });

  it('rejects a malformed updated row instead of returning a half-typed object', async () => {
    const { service } = setup([
      successResponse({ ...UPDATED_API_KEY, updatedAt: '2026-11-03' }),
    ]);

    await expect(
      service.update(VALID_API_KEY.identifier, VALID_UPDATE_INPUT),
    ).rejects.toMatchObject({ name: 'ApiError' });
  });

  it('surfaces a stale version as 409 STALE_WRITE on the updatedAt path', async () => {
    const { service } = setup([
      errorResponse({
        code: 'STALE_WRITE',
        status: 409,
        message: 'The resource changed since it was read',
        details: [{ path: 'updatedAt', message: 'stale version' }],
      }),
    ]);

    const error = await service
      .update(VALID_API_KEY.identifier, VALID_UPDATE_INPUT)
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).code).toBe('STALE_WRITE');
    expect((error as ApiError).issues[0]?.path).toBe('updatedAt');
  });

  it('surfaces an unknown identifier as a coded 404', async () => {
    const { service } = setup([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'API key "ghost" was not found',
      }),
    ]);

    const error = await service
      .update('ghost', VALID_UPDATE_INPUT)
      .catch((cause: unknown) => cause);

    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).code).toBe('NOT_FOUND');
  });

  it('surfaces a semantic violation as 422 SEMANTIC_VALIDATION_FAILED', async () => {
    const { service } = setup([
      errorResponse({
        code: 'SEMANTIC_VALIDATION_FAILED',
        status: 422,
        message: 'expiresAt must be in the future',
        details: [{ path: 'expiresAt', message: 'must be in the future' }],
      }),
    ]);

    const error = await service
      .update(VALID_API_KEY.identifier, VALID_UPDATE_INPUT)
      .catch((cause: unknown) => cause);

    expect((error as ApiError).status).toBe(422);
    expect((error as ApiError).code).toBe('SEMANTIC_VALIDATION_FAILED');
    expect((error as ApiError).issues[0]?.path).toBe('expiresAt');
  });
});

describe('createApiKeysService — remove (AIS-110)', () => {
  it('DELETEs the identified row without a body and resolves to null', async () => {
    const { service, fetchMock } = setup([successResponse(null)]);

    const result = await service.remove(VALID_API_KEY.identifier);

    expect(fetchMock.calls[0]?.url).toBe(
      `${BASE_URL}/api-keys/${VALID_API_KEY.identifier}`,
    );
    expect(fetchMock.calls[0]?.init?.method).toBe('DELETE');
    expect(fetchMock.calls[0]?.init?.body).toBeUndefined();
    expect(result).toBeNull();
  });

  it('advertises no Content-Type when there is no body', async () => {
    const { service, fetchMock } = setup([successResponse(null)]);

    await service.remove(VALID_API_KEY.identifier);

    const headers = (fetchMock.calls[0]?.init?.headers ?? {}) as Record<
      string,
      string
    >;

    expect(Object.hasOwn(headers, 'Content-Type')).toBe(false);
    expect(headers.Accept).toBe('application/json');
  });

  it('surfaces an unknown identifier as a coded 404', async () => {
    const { service } = setup([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'API key "ghost" was not found',
      }),
    ]);

    const error = await service
      .remove('ghost')
      .catch((cause: unknown) => cause);

    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).code).toBe('NOT_FOUND');
  });

  it('rejects a non-null delete payload as contract drift', async () => {
    const { service } = setup([successResponse({})]);

    const error = await service
      .remove(VALID_API_KEY.identifier)
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(UNEXPECTED_PAYLOAD_CODE);
    expect((error as ApiError).issues.length).toBeGreaterThan(0);
  });

  it('rejects the 204 shortcut because it cannot carry meta.requestId', async () => {
    const { service } = setup([emptyResponse(204)]);

    const error = await service
      .remove(VALID_API_KEY.identifier)
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(204);
    expect((error as ApiError).code).toBe(UNEXPECTED_PAYLOAD_CODE);
  });
});
