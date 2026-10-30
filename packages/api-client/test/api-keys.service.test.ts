import { API_KEYS_PATH, createApiKeysService } from '../src/index.js';
import { ApiError, isConflict } from '../src/api-error.js';
import { createHttpClient } from '../src/http-client.js';
import type { RecordedCall } from './mocks/fetch.mock.js';
import {
  createSequenceFetchMock,
  errorResponse,
  successResponse,
} from './mocks/fetch.mock.js';
import {
  SECOND_API_KEY,
  VALID_API_KEY,
  VALID_API_KEY_LIST,
  VALID_CREATE_INPUT,
} from './mocks/api-key.mock.js';

/**
 * Unit tests for `src/api-keys/api-keys.service.ts`.
 *
 * The transport is real, only `fetch` is doubled: this way the test proves the
 * whole chain — URL, method, body, and the zod parse of the response — instead
 * of asserting that one function called another.
 */

const BASE_URL = 'http://api.test/api';

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
});

describe('createApiKeysService — list', () => {
  it('calls GET /api/api-keys and returns the parsed list in order', async () => {
    const { service, fetchMock } = setup([successResponse(VALID_API_KEY_LIST)]);

    const result = await service.list();

    expect(fetchMock.calls[0]?.url).toBe(`${BASE_URL}/api-keys`);
    expect(fetchMock.calls[0]?.init?.method).toBe('GET');
    expect(result).toHaveLength(2);
    expect(result[0]?.identifier).toBe(VALID_API_KEY.identifier);
    expect(result[1]?.identifier).toBe(SECOND_API_KEY.identifier);
  });

  it('returns an empty list when nothing is stored', async () => {
    const { service } = setup([successResponse([])]);

    await expect(service.list()).resolves.toEqual([]);
  });

  it('rejects a malformed row instead of returning a half-typed object', async () => {
    const { service } = setup([
      successResponse([{ ...VALID_API_KEY, expiresAt: '2027-01-31' }]),
    ]);

    await expect(service.list()).rejects.toMatchObject({ name: 'ApiError' });
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
