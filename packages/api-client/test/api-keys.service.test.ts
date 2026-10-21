import {
  API_KEYS_PATH,
  createApiKeysService,
} from '../src/index.js';
import { isConflict } from '../src/api-error.js';
import { createHttpClient } from '../src/http-client.js';
import type { RecordedCall } from './mocks/fetch.mock.js';
import {
  createSequenceFetchMock,
  jsonResponse,
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
    const { service, fetchMock } = setup([
      jsonResponse(VALID_API_KEY_LIST),
    ]);

    const result = await service.list();

    expect(fetchMock.calls[0]?.url).toBe(`${BASE_URL}/api-keys`);
    expect(fetchMock.calls[0]?.init?.method).toBe('GET');
    expect(result).toHaveLength(2);
    expect(result[0]?.identifier).toBe(VALID_API_KEY.identifier);
    expect(result[1]?.identifier).toBe(SECOND_API_KEY.identifier);
  });

  it('returns an empty list when nothing is stored', async () => {
    const { service } = setup([jsonResponse([])]);

    await expect(service.list()).resolves.toEqual([]);
  });

  it('rejects a malformed row instead of returning a half-typed object', async () => {
    const { service } = setup([
      jsonResponse([{ ...VALID_API_KEY, expiresAt: '2027-01-31' }]),
    ]);

    await expect(service.list()).rejects.toMatchObject({ name: 'ApiError' });
  });
});

describe('createApiKeysService — create', () => {
  it('posts the payload unchanged and returns the created key', async () => {
    const { service, fetchMock } = setup([jsonResponse(VALID_API_KEY, 201)]);

    const result = await service.create(VALID_CREATE_INPUT);

    expect(fetchMock.calls[0]?.url).toBe(`${BASE_URL}/api-keys`);
    expect(fetchMock.calls[0]?.init?.method).toBe('POST');
    expect(readBody(fetchMock.calls[0])).toEqual(VALID_CREATE_INPUT);
    expect(result.id).toBe(VALID_API_KEY.id);
  });

  it('does not invent optional fields when the caller omitted them', async () => {
    const { service, fetchMock } = setup([jsonResponse(VALID_API_KEY, 201)]);

    await service.create(VALID_CREATE_INPUT);

    const body = readBody(fetchMock.calls[0]) as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual([
      'apiKey',
      'identifier',
      'name',
    ]);
  });

  it('sends the optional fields when they are present', async () => {
    const { service, fetchMock } = setup([jsonResponse(VALID_API_KEY, 201)]);

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

  it('surfaces a duplicate identifier as a 409 conflict', async () => {
    const { service } = setup([
      jsonResponse(
        {
          statusCode: 409,
          message: 'API key identifier "vapi-staging" already exists.',
          error: 'Conflict',
        },
        409,
      ),
    ]);

    const error = await service
      .create(VALID_CREATE_INPUT)
      .catch((e: unknown) => e);

    expect(isConflict(error)).toBe(true);
    expect((error as { message: string }).message).toContain('vapi-staging');
  });

  it('surfaces a validation failure with the validator messages', async () => {
    const { service } = setup([
      jsonResponse(
        { statusCode: 400, message: ['identifier must be URL-safe'] },
        400,
      ),
    ]);

    const error = await service
      .create(VALID_CREATE_INPUT)
      .catch((e: unknown) => e);

    expect((error as { status: number }).status).toBe(400);
    expect((error as { details: readonly string[] }).details).toEqual([
      'identifier must be URL-safe',
    ]);
  });
});
