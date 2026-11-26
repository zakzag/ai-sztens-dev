import { z } from 'zod';
import {
  UNEXPECTED_PAYLOAD_CODE,
  UNEXPECTED_PAYLOAD_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  HTTP_STATUS,
} from '../src/api-error.const.js';
import {
  ApiError,
  isConflict,
  isNetworkError,
  isNotFoundError,
  isValidationError,
} from '../src/api-error.js';
import { createHttpClient, joinUrl } from '../src/http-client.js';
import { UnresolvedPathParameterError } from '../src/endpoint-path.js';
import type { HttpEvent } from '../src/http-client.interface.js';
import type { RecordedCall } from './mocks/fetch.mock.js';
import {
  TEST_META,
  createRejectingFetchMock,
  createSequenceFetchMock,
  emptyResponse,
  errorResponse,
  jsonResponse,
  paginatedResponse,
  successResponse,
  textResponse,
  withHeader,
} from './mocks/fetch.mock.js';

/**
 * Unit tests for the transport.
 *
 * Everything is doubled: the `fetch` implementation and the schema are injected,
 * so the suite never touches the network and every failure mode (status,
 * contract drift, dead network) is reproducible.
 *
 * Since the envelope landed, a 2xx body is `{ data, meta }` and a failure body is
 * `{ error }`; the legacy Nest body is still covered because a proxy can answer
 * with something that is not ours.
 */

const BASE_URL = 'http://api.test/api';

const itemSchema = z.object({ id: z.string(), name: z.string() });

/** Reads the JSON body out of a recorded call. */
function readBody(call: RecordedCall | undefined): unknown {
  const body = call?.init?.body;

  if (typeof body !== 'string') {
    throw new Error('expected a string body on the recorded call');
  }

  return JSON.parse(body) as unknown;
}

/** Reads a header case-insensitively from a recorded call. */
function readHeader(
  call: RecordedCall | undefined,
  name: string,
): string | undefined {
  const headers = call?.init?.headers as Record<string, string> | undefined;
  return headers?.[name];
}

describe('joinUrl', () => {
  it('joins with exactly one slash', () => {
    expect(joinUrl('/api', '/api-keys')).toBe('/api/api-keys');
  });

  it('tolerates a trailing slash on the base and a missing leading slash on the path', () => {
    expect(joinUrl('/api/', 'api-keys')).toBe('/api/api-keys');
  });

  it('tolerates both being slashed', () => {
    expect(joinUrl('/api///', '/api-keys')).toBe('/api/api-keys');
  });

  it('keeps an absolute base URL intact', () => {
    expect(joinUrl('https://api.example.com/api', '/api-keys')).toBe(
      'https://api.example.com/api/api-keys',
    );
  });
});

describe('createHttpClient — GET', () => {
  it('returns the `data` of the success envelope', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const result = await client.get('/items', itemSchema);

    expect(result).toEqual({ id: '1', name: 'first' });
    expect(fetchMock.calls[0]?.url).toBe(`${BASE_URL}/items`);
    expect(fetchMock.calls[0]?.init?.method).toBe('GET');
  });

  it('accepts an empty list as `data: []`', async () => {
    const fetchMock = createSequenceFetchMock([successResponse([])]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    await expect(client.get('/items', z.array(itemSchema))).resolves.toEqual(
      [],
    );
  });

  it('sends no Content-Type on a bodyless request', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    await client.get('/items', itemSchema);

    expect(readHeader(fetchMock.calls[0], 'Content-Type')).toBeUndefined();
    expect(readHeader(fetchMock.calls[0], 'Accept')).toBe('application/json');
  });

  it('adds a bearer token when the supplier returns one', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      getToken: () => 'session-token',
      fetchImpl: fetchMock.fetchImpl,
    });

    await client.get('/items', itemSchema);

    expect(readHeader(fetchMock.calls[0], 'Authorization')).toBe(
      'Bearer session-token',
    );
  });

  it('omits the Authorization header when the token is null', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      getToken: () => null,
      fetchImpl: fetchMock.fetchImpl,
    });

    await client.get('/items', itemSchema);

    expect(readHeader(fetchMock.calls[0], 'Authorization')).toBeUndefined();
  });

  it('omits the Authorization header when the token is empty', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      getToken: () => '',
      fetchImpl: fetchMock.fetchImpl,
    });

    await client.get('/items', itemSchema);

    expect(readHeader(fetchMock.calls[0], 'Authorization')).toBeUndefined();
  });
});

describe('createHttpClient — POST', () => {
  it('serialises the body, advertises JSON and unwraps the envelope', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '2', name: 'created' }, 201),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const result = await client.post('/items', { name: 'created' }, itemSchema);

    expect(result.id).toBe('2');
    expect(fetchMock.calls[0]?.init?.method).toBe('POST');
    expect(readBody(fetchMock.calls[0])).toEqual({ name: 'created' });
    expect(readHeader(fetchMock.calls[0], 'Content-Type')).toBe(
      'application/json',
    );
  });
});

describe('createHttpClient — error envelope', () => {
  it('exposes code, requestId and issues of a 409', async () => {
    const fetchMock = createSequenceFetchMock([
      errorResponse({
        code: 'API_KEY_IDENTIFIER_CONFLICT',
        status: 409,
        message: 'identifier already exists',
        details: [{ path: 'identifier', message: 'already taken' }],
      }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .post('/items', {}, itemSchema)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(isConflict(error)).toBe(true);
    expect((error as ApiError).code).toBe('API_KEY_IDENTIFIER_CONFLICT');
    expect((error as ApiError).requestId).toBe(TEST_META.requestId);
    expect((error as ApiError).issues).toEqual([
      { path: 'identifier', message: 'already taken' },
    ]);
    expect((error as ApiError).details).toEqual(['identifier: already taken']);
  });

  it('maps a VALIDATION_FAILED envelope onto a validation error', async () => {
    const fetchMock = createSequenceFetchMock([
      errorResponse({
        code: 'VALIDATION_FAILED',
        status: 400,
        message: 'The request payload does not match the API contract.',
        details: [{ path: 'name', message: 'Required' }],
      }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .post('/items', {}, itemSchema)
      .catch((caught: unknown) => caught);

    expect(isValidationError(error)).toBe(true);
    expect((error as ApiError).code).toBe('VALIDATION_FAILED');
    expect((error as ApiError).issues[0]?.path).toBe('name');
  });

  it('keeps an unknown code instead of rejecting the body', async () => {
    const fetchMock = createSequenceFetchMock([
      errorResponse({
        code: 'SOMETHING_NEW_FROM_A_NEWER_SERVER',
        status: 500,
        message: 'An unexpected server error occurred.',
      }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((caught: unknown) => caught);

    expect((error as ApiError).code).toBe('SOMETHING_NEW_FROM_A_NEWER_SERVER');
  });
});

describe('createHttpClient — legacy failures', () => {
  it('still maps a Nest 409 body to a conflict ApiError', async () => {
    const fetchMock = createSequenceFetchMock([
      jsonResponse(
        {
          statusCode: 409,
          message: 'API key identifier "vapi-prod" already exists.',
          error: 'Conflict',
        },
        HTTP_STATUS.CONFLICT,
      ),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .post('/items', {}, itemSchema)
      .catch((caught: unknown) => caught);

    expect(isConflict(error)).toBe(true);
    expect((error as ApiError).message).toBe(
      'API key identifier "vapi-prod" already exists.',
    );
    expect((error as ApiError).code).toBeNull();
    expect((error as ApiError).requestId).toBeNull();
  });

  it('keeps every validator message as a detail', async () => {
    const fetchMock = createSequenceFetchMock([
      jsonResponse(
        {
          statusCode: 400,
          message: ['name should not be empty', 'apiKey should not be empty'],
          error: 'Bad Request',
        },
        HTTP_STATUS.BAD_REQUEST,
      ),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .post('/items', {}, itemSchema)
      .catch((caught: unknown) => caught);

    expect(isValidationError(error)).toBe(true);
    expect((error as ApiError).details).toHaveLength(2);
  });

  it('falls back to the status text when the body has no message', async () => {
    const fetchMock = createSequenceFetchMock([
      new Response('{}', { status: 500, statusText: 'Internal Server Error' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((caught: unknown) => caught);

    expect((error as ApiError).message).toBe('Internal Server Error');
  });

  it('survives a non-JSON proxy error body and still exposes the status', async () => {
    const fetchMock = createSequenceFetchMock([
      textResponse('<html>502 Bad Gateway</html>', 502),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).details).toEqual([]);
    expect((error as ApiError).code).toBeNull();
  });

  it('exposes the requested url and is recognised as a not-found error', async () => {
    const fetchMock = createSequenceFetchMock([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'gone',
      }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((caught: unknown) => caught);

    expect(isNotFoundError(error)).toBe(true);
    expect((error as ApiError).url).toBe(`${BASE_URL}/items`);
  });
});

describe('createHttpClient — contract drift', () => {
  it('rejects a bare payload (no envelope) as UNEXPECTED_PAYLOAD', async () => {
    const fetchMock = createSequenceFetchMock([
      jsonResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((caught: unknown) => caught);

    expect((error as ApiError).message).toBe(UNEXPECTED_PAYLOAD_MESSAGE);
    expect((error as ApiError).code).toBe(UNEXPECTED_PAYLOAD_CODE);
  });

  it('rejects an envelope without `meta`', async () => {
    const fetchMock = createSequenceFetchMock([
      jsonResponse({ data: { id: '1', name: 'first' } }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    await expect(client.get('/items', itemSchema)).rejects.toMatchObject({
      code: UNEXPECTED_PAYLOAD_CODE,
    });
  });

  it('rejects a null `data` for a resource schema', async () => {
    const fetchMock = createSequenceFetchMock([successResponse(null)]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    await expect(client.get('/items', itemSchema)).rejects.toMatchObject({
      code: UNEXPECTED_PAYLOAD_CODE,
    });
  });

  it('accepts a null `data` when the caller schema allows it', async () => {
    const fetchMock = createSequenceFetchMock([successResponse(null)]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    await expect(client.get('/items', z.null())).resolves.toBeNull();
  });

  it('reports the offending field of a schema mismatch', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 42 }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((caught: unknown) => caught);

    expect((error as ApiError).details.join(' ')).toContain('name');
  });

  it('exposes payload-relative field issues on a drift', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 42 }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((caught: unknown) => caught);

    const apiError = error as ApiError;

    expect(apiError.code).toBe(UNEXPECTED_PAYLOAD_CODE);
    expect(apiError.issues).toHaveLength(1);
    expect(apiError.issues[0]?.path).toBe('name');
    expect(apiError.issues[0]?.path.startsWith('data')).toBe(false);
    expect(apiError.details).toEqual([
      `name: ${apiError.issues[0]?.message ?? ''}`,
    ]);
  });

  it('exposes a payload-level issue for a null `data` on a resource schema', async () => {
    const fetchMock = createSequenceFetchMock([successResponse(null)]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((caught: unknown) => caught);

    const apiError = error as ApiError;

    expect(apiError.issues.length).toBeGreaterThan(0);
    expect(apiError.issues[0]?.path).toBe('');
    expect(apiError.details).toHaveLength(apiError.issues.length);
  });

  it('rejects an empty 2xx body as a contract failure', async () => {
    const fetchMock = createSequenceFetchMock([emptyResponse(200)]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    await expect(client.get('/items', itemSchema)).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('createHttpClient — transport failures', () => {
  it('maps a rejected fetch to a network ApiError with a null status', async () => {
    const fetchMock = createRejectingFetchMock();
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((caught: unknown) => caught);

    expect((error as ApiError).message).toBe(NETWORK_ERROR_MESSAGE);
    expect((error as ApiError).status).toBeNull();
    expect(isNetworkError(error)).toBe(true);
  });

  it('keeps the original failure as the cause', async () => {
    const rootCause = new TypeError('ECONNREFUSED');
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: createRejectingFetchMock(rootCause).fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((caught: unknown) => caught);

    expect((error as ApiError).cause).toBe(rootCause);
  });
});

describe('createHttpClient — PUT', () => {
  it('serialises the body, advertises JSON and unwraps the envelope', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'replaced' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const result = await client.put(
      '/items/1',
      { name: 'replaced' },
      itemSchema,
    );

    expect(result).toEqual({ id: '1', name: 'replaced' });
    expect(fetchMock.calls[0]?.init?.method).toBe('PUT');
    expect(readBody(fetchMock.calls[0])).toEqual({ name: 'replaced' });
    expect(readHeader(fetchMock.calls[0], 'Content-Type')).toBe(
      'application/json',
    );
  });

  it('maps a 404 to a not-found ApiError', async () => {
    const fetchMock = createSequenceFetchMock([
      errorResponse({ code: 'NOT_FOUND', status: 404, message: 'gone' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .put('/items/1', {}, itemSchema)
      .catch((caught: unknown) => caught);

    expect(isNotFoundError(error)).toBe(true);
    expect((error as ApiError).status).toBe(404);
  });
});

describe('createHttpClient — PATCH', () => {
  it('sends only the changed fields plus the concurrency token', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'renamed' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const result = await client.patch(
      '/items/1',
      { name: 'renamed', updatedAt: '2026-10-21T15:00:00.000Z' },
      itemSchema,
    );

    expect(result.name).toBe('renamed');
    expect(fetchMock.calls[0]?.init?.method).toBe('PATCH');
    expect(readBody(fetchMock.calls[0])).toEqual({
      name: 'renamed',
      updatedAt: '2026-10-21T15:00:00.000Z',
    });
  });

  it('exposes a 409 STALE_WRITE code with its field issue', async () => {
    const fetchMock = createSequenceFetchMock([
      errorResponse({
        code: 'STALE_WRITE',
        status: 409,
        message: 'The row changed since it was read.',
        details: [{ path: 'updatedAt', message: 'stale version' }],
      }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .patch('/items/1', { name: 'x', updatedAt: 'old' }, itemSchema)
      .catch((caught: unknown) => caught);

    expect(isConflict(error)).toBe(true);
    expect((error as ApiError).code).toBe('STALE_WRITE');
    expect((error as ApiError).issues[0]?.path).toBe('updatedAt');
  });
});

describe('createHttpClient — DELETE', () => {
  it('sends no body and no Content-Type', async () => {
    const fetchMock = createSequenceFetchMock([successResponse(null)]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    await expect(client.delete('/items/1', z.null())).resolves.toBeNull();

    expect(fetchMock.calls[0]?.init?.method).toBe('DELETE');
    expect(fetchMock.calls[0]?.init?.body).toBeUndefined();
    expect(readHeader(fetchMock.calls[0], 'Content-Type')).toBeUndefined();
  });

  it('maps a 404 of a soft-deleted row to a not-found ApiError', async () => {
    const fetchMock = createSequenceFetchMock([
      errorResponse({ code: 'NOT_FOUND', status: 404, message: 'gone' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .delete('/items/1', z.null())
      .catch((caught: unknown) => caught);

    expect(isNotFoundError(error)).toBe(true);
  });

  it('rejects a 200 body that is not `data: null`', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'still here' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    await expect(client.delete('/items/1', z.null())).rejects.toMatchObject({
      code: UNEXPECTED_PAYLOAD_CODE,
    });
  });
});

describe('createHttpClient — getList', () => {
  it('returns the rows and the pagination block', async () => {
    const fetchMock = createSequenceFetchMock([
      paginatedResponse([{ id: '1', name: 'first' }], {
        total: 42,
        totalPages: 3,
      }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const result = await client.getList('/items', z.array(itemSchema), {
      query: { page: 1, limit: 20, order: 'desc' },
    });

    expect(result.data).toEqual([{ id: '1', name: 'first' }]);
    expect(result.meta.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 42,
      totalPages: 3,
    });
    expect(fetchMock.calls[0]?.init?.method).toBe('GET');
  });

  it('sends no query string when every field is at its default', async () => {
    const fetchMock = createSequenceFetchMock([paginatedResponse([])]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    await client.getList('/items', z.array(itemSchema), {
      query: { page: 1, limit: 20, order: 'desc' },
    });

    expect(fetchMock.calls[0]?.url).toBe(`${BASE_URL}/items`);
  });

  it('encodes only the changed fields', async () => {
    const fetchMock = createSequenceFetchMock([paginatedResponse([])]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    await client.getList('/items', z.array(itemSchema), {
      query: { page: 2, limit: 20, order: 'desc', sort: 'name' },
    });

    expect(fetchMock.calls[0]?.url).toBe(`${BASE_URL}/items?page=2&sort=name`);
  });

  it('omits the resource default sort', async () => {
    const fetchMock = createSequenceFetchMock([paginatedResponse([])]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    await client.getList('/items', z.array(itemSchema), {
      query: { page: 1, limit: 20, order: 'desc', sort: 'name' },
      defaults: { limit: 20, order: 'desc', sort: 'name' },
    });

    expect(fetchMock.calls[0]?.url).toBe(`${BASE_URL}/items`);
  });

  it('turns null rows into an empty page', async () => {
    const fetchMock = createSequenceFetchMock([
      paginatedResponse(null, { total: 0, totalPages: 0 }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const result = await client.getList('/items', z.array(itemSchema), {
      query: { page: 1, limit: 20, order: 'desc' },
    });

    expect(result.data).toEqual([]);
  });

  it('fails with UNEXPECTED_PAYLOAD when meta.pagination is missing', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse([{ id: '1', name: 'first' }]),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .getList('/items', z.array(itemSchema), {
        query: { page: 1, limit: 20, order: 'desc' },
      })
      .catch((caught: unknown) => caught);

    expect((error as ApiError).code).toBe(UNEXPECTED_PAYLOAD_CODE);
    expect((error as ApiError).issues[0]?.path).toBe('meta.pagination');
  });

  it('maps a 400 of the query validation to a validation error', async () => {
    const fetchMock = createSequenceFetchMock([
      errorResponse({
        code: 'VALIDATION_FAILED',
        status: 400,
        message: 'The request payload does not match the API contract.',
        details: [{ path: 'limit', message: 'Too big' }],
      }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .getList('/items', z.array(itemSchema), {
        query: { page: 1, limit: 20, order: 'desc' },
      })
      .catch((caught: unknown) => caught);

    expect(isValidationError(error)).toBe(true);
    expect((error as ApiError).details).toEqual(['limit: Too big']);
  });
});

describe('createHttpClient — onEvent', () => {
  it('reports a successful attempt without leaking the request headers', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      getToken: () => 'session-token',
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.get('/items', itemSchema);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      method: 'GET',
      path: '/items',
      status: 200,
      outcome: 'success',
    });
    expect(Number.isFinite(events[0]?.durationMs)).toBe(true);
    expect(events[0]?.durationMs).toBeGreaterThanOrEqual(0);
    // The event carries exactly these keys: no header value exists on the type,
    // and the body travels only as a masked prefix (AIS-152).
    expect(Object.keys(events[0] ?? {}).sort()).toEqual([
      'bodyPreview',
      'durationMs',
      'method',
      'outcome',
      'path',
      'query',
      'requestId',
      'responseMeta',
      'status',
    ]);
    expect(JSON.stringify(events[0])).not.toContain('session-token');
  });

  it('reports a failed status as an error with the status kept', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([
      errorResponse({ code: 'NOT_FOUND', status: 404, message: 'gone' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.get('/items', itemSchema).catch(() => undefined);

    expect(events[0]).toMatchObject({
      method: 'GET',
      status: 404,
      outcome: 'error',
    });
  });

  it('reports a dead network with a null status', async () => {
    const events: HttpEvent[] = [];
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: createRejectingFetchMock().fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.get('/items', itemSchema).catch(() => undefined);

    expect(events[0]).toMatchObject({ status: null, outcome: 'error' });
  });

  it('reports a contract drift as an error even though the status is 2xx', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([
      jsonResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.get('/items', itemSchema).catch(() => undefined);

    expect(events[0]).toMatchObject({ status: 200, outcome: 'error' });
  });

  it('reports the path without the query string', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([paginatedResponse([])]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.getList('/items', z.array(itemSchema), {
      query: { page: 3, limit: 20, order: 'desc' },
    });

    expect(events[0]?.path).toBe('/items');
  });

  it('reports the generated list query next to the bare path', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([paginatedResponse([])]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.getList('/items', z.array(itemSchema), {
      query: { page: 3, limit: 20, order: 'desc' },
    });

    const sentUrl = new URL(fetchMock.calls[0]?.url ?? 'http://api.test');
    expect(events[0]?.query).toBe(sentUrl.search.replace(/^\?/, ''));
    expect(events[0]?.query).toContain('page=3');
  });

  it('reports the request id from the response header first', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([
      withHeader(successResponse(null), 'x-request-id', 'header-id'),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.delete('/items/1', z.null());

    expect(events[0]?.requestId).toBe('header-id');
  });

  it('falls back to the envelope request id when the header is missing', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.get('/items', itemSchema);

    expect(events[0]?.requestId).toBe(TEST_META.requestId);
  });

  it('falls back to the error request id on a failed status', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([
      errorResponse({
        code: 'NOT_FOUND',
        status: 404,
        message: 'gone',
        requestId: 'error-id',
      }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.get('/items', itemSchema).catch(() => undefined);

    expect(events[0]?.requestId).toBe('error-id');
  });

  it('prefers the header over the error envelope id', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([
      withHeader(
        errorResponse({ code: 'NOT_FOUND', status: 404, message: 'gone' }),
        'x-request-id',
        'header-id',
      ),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.get('/items', itemSchema).catch(() => undefined);

    expect(events[0]?.requestId).toBe('header-id');
  });

  it('reports a null request id for a dead network', async () => {
    const events: HttpEvent[] = [];
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: createRejectingFetchMock().fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.get('/items', itemSchema).catch(() => undefined);

    expect(events[0]?.requestId).toBeNull();
    expect(events[0]?.responseMeta).toBeNull();
  });

  it('reports the body prefix of a write and nothing for a read', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'first' }),
      successResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.post('/items', { name: 'first' }, itemSchema);
    await client.get('/items', itemSchema);

    expect(events[0]?.bodyPreview).toBe('{"name":"first"}');
    expect(events[1]?.bodyPreview).toBeNull();
  });

  it('never puts the token into the body prefix', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      getToken: () => 'session-token',
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.post(
      '/items',
      { name: 'first', token: 'body-token' },
      itemSchema,
    );

    expect(events[0]?.bodyPreview).not.toContain('body-token');
    expect(events[0]?.bodyPreview).not.toContain('session-token');
  });

  it('reports the response meta of a paginated list', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([paginatedResponse([])]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.getList('/items', z.array(itemSchema), {
      query: { page: 1, limit: 20, order: 'desc' },
    });

    expect(events[0]?.responseMeta).toEqual({
      requestId: TEST_META.requestId,
      timestamp: TEST_META.timestamp,
      totalItems: 1,
    });
  });

  it('reports a null total for an endpoint that does not paginate', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.get('/items', itemSchema);

    expect(events[0]?.responseMeta?.totalItems).toBeNull();
  });

  it('reports no response meta for a contract drift and a failed status', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([
      jsonResponse({ id: '1', name: 'first' }),
      errorResponse({ code: 'NOT_FOUND', status: 404, message: 'gone' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client.get('/items', itemSchema).catch(() => undefined);
    await client.get('/items', itemSchema).catch(() => undefined);

    expect(events[0]?.responseMeta).toBeNull();
    expect(events[1]?.responseMeta).toBeNull();
  });

  it('does not fail the request when the listener throws', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: () => {
        throw new Error('sink is down');
      },
    });

    await expect(client.get('/items', itemSchema)).resolves.toEqual({
      id: '1',
      name: 'first',
    });
  });

  it('emits nothing when no listener is configured', async () => {
    const fetchMock = createSequenceFetchMock([
      successResponse({ id: '1', name: 'first' }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    await expect(client.get('/items', itemSchema)).resolves.toBeDefined();
  });
});

describe('createHttpClient — unresolved path parameter', () => {
  it('rejects before fetching anything', async () => {
    const fetchMock = createSequenceFetchMock([successResponse(null)]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    await expect(
      client.delete('/items/:identifier', z.null()),
    ).rejects.toBeInstanceOf(UnresolvedPathParameterError);

    expect(fetchMock.calls).toHaveLength(0);
  });

  it('emits no event for a path it never called', async () => {
    const events: HttpEvent[] = [];
    const fetchMock = createSequenceFetchMock([successResponse(null)]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
      onEvent: (event) => events.push(event),
    });

    await client
      .patch('/items/:identifier', {}, itemSchema)
      .catch(() => undefined);

    expect(events).toEqual([]);
  });
});
