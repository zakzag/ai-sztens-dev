import { z } from 'zod';
import {
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
import type { RecordedCall } from './mocks/fetch.mock.js';
import {
  createFetchMock,
  createRejectingFetchMock,
  createSequenceFetchMock,
  emptyResponse,
  jsonResponse,
  textResponse,
} from './mocks/fetch.mock.js';

/**
 * Unit tests for the transport.
 *
 * Everything is doubled: the `fetch` implementation and the schema are injected,
 * so the suite never touches the network and every failure mode (status,
 * contract drift, dead network) is reproducible.
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
  it('returns the payload parsed by the supplied schema', async () => {
    const fetchMock = createSequenceFetchMock([
      jsonResponse({ id: '1', name: 'first' }),
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

  it('sends no Content-Type on a bodyless request', async () => {
    const fetchMock = createSequenceFetchMock([
      jsonResponse({ id: '1', name: 'first' }),
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
      jsonResponse({ id: '1', name: 'first' }),
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
      jsonResponse({ id: '1', name: 'first' }),
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
      jsonResponse({ id: '1', name: 'first' }),
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
  it('serialises the body and advertises JSON', async () => {
    const fetchMock = createSequenceFetchMock([
      jsonResponse({ id: '2', name: 'created' }, 201),
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

describe('createHttpClient — failures', () => {
  it('maps a 409 to a conflict ApiError carrying the API message', async () => {
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

    await expect(client.post('/items', {}, itemSchema)).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      message: 'API key identifier "vapi-prod" already exists.',
    });
  });

  it('reports a 409 as a conflict through the guard', async () => {
    const fetchMock = createSequenceFetchMock([
      jsonResponse({ message: 'duplicate' }, HTTP_STATUS.CONFLICT),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client.get('/items', itemSchema).catch((e: unknown) => e);

    expect(isConflict(error)).toBe(true);
    expect(isValidationError(error)).toBe(false);
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
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
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
      .catch((e: unknown) => e);

    expect((error as ApiError).message).toBe('Internal Server Error');
  });

  it('survives a non-JSON error body and still exposes the status', async () => {
    const fetchMock = createSequenceFetchMock([
      textResponse('<html>502 Bad Gateway</html>', 500),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).details).toEqual([]);
  });

  it('reports a schema mismatch as an ApiError with the offending path', async () => {
    const fetchMock = createSequenceFetchMock([
      jsonResponse({ id: '1', name: 42 }),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((e: unknown) => e);

    expect((error as ApiError).message).toBe(UNEXPECTED_PAYLOAD_MESSAGE);
    expect((error as ApiError).details.join(' ')).toContain('name');
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

  it('maps a rejected fetch to a network ApiError with a null status', async () => {
    const fetchMock = createRejectingFetchMock();
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((e: unknown) => e);

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
      .catch((e: unknown) => e);

    expect((error as ApiError).cause).toBe(rootCause);
  });

  it('exposes the requested url and is recognised as a not-found error', async () => {
    const fetchMock = createSequenceFetchMock([
      jsonResponse({ message: 'nope' }, HTTP_STATUS.NOT_FOUND),
    ]);
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetchImpl: fetchMock.fetchImpl,
    });

    const error = await client
      .get('/items', itemSchema)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(isNotFoundError(error)).toBe(true);
    expect((error as ApiError).url).toBe(`${BASE_URL}/items`);
  });
});
