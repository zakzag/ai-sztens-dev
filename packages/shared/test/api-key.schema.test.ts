import {
  API_KEY_DESCRIPTION_MAX_LENGTH,
  API_KEY_NAME_MAX_LENGTH,
} from '../src/contract/api-keys/api-keys.const.js';
import type {
  ApiKey,
  CreateApiKeyInput,
} from '../src/contract/api-keys/api-keys.interface.js';
import {
  apiKeyListSchema,
  apiKeySchema,
  createApiKeySchema,
} from '../src/contract/api-keys/api-keys.schema.js';

/**
 * Unit tests for `src/contract/api-keys/api-keys.schema.ts`.
 *
 * The fixtures are shaped exactly like the AIS-40 wire contract: ISO 8601
 * timestamps with a `Z` suffix and explicit `null`s for the optional columns.
 * Every branch that matters to the API client is covered — a rejected payload
 * must fail *here*, not inside a React component.
 */

const VALID_RESPONSE = {
  id: '5d0f8f0e-9a2b-4c7e-8f3a-1b2c3d4e5f60',
  name: 'Vapi prod',
  identifier: 'vapi-prod',
  description: 'Production voice provider token',
  apiKey: 'sk-live-abcdef123456',
  expiresAt: '2027-01-31T23:00:00.000Z',
  createdAt: '2026-10-21T15:00:00.000Z',
  updatedAt: '2026-10-21T15:00:00.000Z',
} as const;

describe('apiKeySchema', () => {
  it('parses a full response payload', () => {
    const result = apiKeySchema.parse(VALID_RESPONSE);

    expect(result.identifier).toBe('vapi-prod');
    expect(result.expiresAt).toBe('2027-01-31T23:00:00.000Z');
  });

  it('accepts explicit nulls for description and expiresAt', () => {
    const result = apiKeySchema.parse({
      ...VALID_RESPONSE,
      description: null,
      expiresAt: null,
    });

    expect(result.description).toBeNull();
    expect(result.expiresAt).toBeNull();
  });

  it('accepts a numeric UTC offset instead of Z', () => {
    const result = apiKeySchema.parse({
      ...VALID_RESPONSE,
      expiresAt: '2027-02-01T00:00:00+01:00',
    });

    expect(result.expiresAt).toBe('2027-02-01T00:00:00+01:00');
  });

  it('rejects a timestamp without a timezone', () => {
    expect(() =>
      apiKeySchema.parse({
        ...VALID_RESPONSE,
        updatedAt: '2026-10-21T15:00:00',
      }),
    ).toThrow();
  });

  it('rejects a missing identifier', () => {
    const { identifier, ...withoutIdentifier } = VALID_RESPONSE;

    expect(identifier).toBe('vapi-prod');
    expect(() => apiKeySchema.parse(withoutIdentifier)).toThrow();
  });

  it('rejects an identifier with a space (not URL-safe)', () => {
    expect(() =>
      apiKeySchema.parse({ ...VALID_RESPONSE, identifier: 'vapi prod' }),
    ).toThrow();
  });

  it('rejects an identifier over 200 characters', () => {
    expect(() =>
      apiKeySchema.parse({ ...VALID_RESPONSE, identifier: 'a'.repeat(201) }),
    ).toThrow();
  });

  it('accepts a name and identifier at the 200 character boundary', () => {
    const boundary = 'a'.repeat(API_KEY_NAME_MAX_LENGTH);
    const result = apiKeySchema.parse({
      ...VALID_RESPONSE,
      name: boundary,
      identifier: boundary,
    });

    expect(result.name).toHaveLength(API_KEY_NAME_MAX_LENGTH);
  });

  it('rejects an empty name', () => {
    expect(() => apiKeySchema.parse({ ...VALID_RESPONSE, name: '' })).toThrow();
  });

  it('rejects a description over the limit', () => {
    expect(() =>
      apiKeySchema.parse({
        ...VALID_RESPONSE,
        description: 'x'.repeat(API_KEY_DESCRIPTION_MAX_LENGTH + 1),
      }),
    ).toThrow();
  });

  it('rejects a non-uuid id', () => {
    expect(() => apiKeySchema.parse({ ...VALID_RESPONSE, id: '1' })).toThrow();
  });

  it('strips unknown keys instead of failing (additive backend fields)', () => {
    const result = apiKeySchema.parse({ ...VALID_RESPONSE, futureField: 'x' });

    expect(Object.keys(result)).not.toContain('futureField');
  });

  it('keeps the parsed result assignable to the shared ApiKey type', () => {
    const result: ApiKey = apiKeySchema.parse(VALID_RESPONSE);

    expect(result.apiKey).toBe(VALID_RESPONSE.apiKey);
  });
});

describe('apiKeyListSchema', () => {
  it('parses an array of keys', () => {
    const result = apiKeyListSchema.parse([VALID_RESPONSE, VALID_RESPONSE]);

    expect(result).toHaveLength(2);
  });

  it('accepts an empty list', () => {
    expect(apiKeyListSchema.parse([])).toEqual([]);
  });

  it('rejects a non-array payload', () => {
    expect(() => apiKeyListSchema.parse({ items: [] })).toThrow();
  });

  it('rejects a list containing one malformed element', () => {
    expect(() =>
      apiKeyListSchema.parse([VALID_RESPONSE, { ...VALID_RESPONSE, name: '' }]),
    ).toThrow();
  });
});

describe('createApiKeySchema', () => {
  const MINIMAL_INPUT = {
    name: 'Vapi dev',
    identifier: 'vapi-dev',
    apiKey: 'sk-test-123',
  } as const;

  it('accepts the minimal payload and leaves the optional fields undefined', () => {
    const result = createApiKeySchema.parse(MINIMAL_INPUT);

    expect(result.description).toBeUndefined();
    expect(result.expiresAt).toBeUndefined();
  });

  it('accepts the optional fields when present', () => {
    const input = {
      ...MINIMAL_INPUT,
      description: 'dev token',
      expiresAt: '2027-01-31T23:00:00.000Z',
    } as const;
    const result: CreateApiKeyInput = createApiKeySchema.parse(input);

    expect(result.description).toBe('dev token');
  });

  it('rejects a missing apiKey', () => {
    const { apiKey, ...withoutValue } = MINIMAL_INPUT;

    expect(apiKey).toBe('sk-test-123');
    expect(() => createApiKeySchema.parse(withoutValue)).toThrow();
  });

  it('rejects an empty apiKey', () => {
    expect(() =>
      createApiKeySchema.parse({ ...MINIMAL_INPUT, apiKey: '' }),
    ).toThrow();
  });

  it('rejects an expiresAt that is not ISO 8601', () => {
    expect(() =>
      createApiKeySchema.parse({ ...MINIMAL_INPUT, expiresAt: '2027-01-31' }),
    ).toThrow();
  });

  it('rejects an unknown top-level field (server-managed keys are not injectable)', () => {
    // Requests are `.strict()`: a client must not be able to “set” `id` and
    // believe the server accepted it. Response schemas stay tolerant instead —
    // that is where an additive backend field must not break a bundle.
    expect(() =>
      createApiKeySchema.parse({ ...MINIMAL_INPUT, id: 'x' }),
    ).toThrow();
  });

  it('rejects an identifier with a slash', () => {
    expect(() =>
      createApiKeySchema.parse({ ...MINIMAL_INPUT, identifier: 'vapi/dev' }),
    ).toThrow();
  });
});
