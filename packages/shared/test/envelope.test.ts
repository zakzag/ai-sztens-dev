import {
  apiKeyListSchema,
  apiKeySchema,
} from '../src/contract/api-keys/api-keys.schema.js';
import type { ApiKey } from '../src/contract/api-keys/api-keys.interface.js';
import type {
  ApiEnvelope,
  ResponseMeta,
} from '../src/contract/envelope.interface.js';
import {
  paginationMetaSchema,
  responseMetaSchema,
  successEnvelopeSchema,
  toSuccessEnvelope,
} from '../src/contract/envelope.schema.js';

/**
 * Unit tests for `src/contract/envelope.schema.ts` (D2, D4, D6).
 *
 * The envelope is the one shape every successful response shares, so every
 * branch is pinned here: object / array / `null` data, a minimal `meta` (the
 * default: only `requestId` + `timestamp`) and a paginated one. A regression in
 * this file means the client would parse a body that the server no longer
 * sends.
 */

const META: ResponseMeta = {
  requestId: '0192f3c4-0000-7000-8000-000000000000',
  timestamp: '2026-10-26T15:21:48.752Z',
};

const PAGINATED_META: ResponseMeta = {
  ...META,
  pagination: { page: 1, limit: 20, total: 42, totalPages: 3 },
};

const VALID_KEY = {
  id: '5d0f8f0e-9a2b-4c7e-8f3a-1b2c3d4e5f60',
  name: 'Vapi prod',
  identifier: 'vapi-prod',
  description: null,
  apiKey: 'sk-live-abcdef123456',
  expiresAt: null,
  createdAt: '2026-10-21T15:00:00.000Z',
  updatedAt: '2026-10-21T15:00:00.000Z',
} as const;

describe('toSuccessEnvelope', () => {
  it('wraps an object payload', () => {
    const envelope = toSuccessEnvelope({ id: 'abc' }, META);

    expect(envelope).toEqual({ data: { id: 'abc' }, meta: META });
  });

  it('wraps an array payload', () => {
    const envelope = toSuccessEnvelope([1, 2], META);

    expect(envelope.data).toEqual([1, 2]);
  });

  it('wraps an empty array instead of null', () => {
    const envelope = toSuccessEnvelope<readonly number[]>([], META);

    expect(envelope.data).toEqual([]);
    expect(envelope.data).not.toBeNull();
  });

  it('keeps an explicit null payload for a success without data', () => {
    const envelope = toSuccessEnvelope<null>(null, META);

    expect(envelope.data).toBeNull();
    expect(envelope.meta).toEqual(META);
  });

  it('keeps the default meta without a pagination key', () => {
    const envelope = toSuccessEnvelope({ id: 'abc' }, META);

    expect(Object.keys(envelope.meta)).toEqual(['requestId', 'timestamp']);
    expect(envelope.meta.requestId).toBe(META.requestId);
  });

  it('keeps pagination when the meta carries it', () => {
    const envelope = toSuccessEnvelope([], PAGINATED_META);

    expect(envelope.meta.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 42,
      totalPages: 3,
    });
  });

  it('does not mutate the payload or the meta it was given', () => {
    const data = { id: 'abc' };
    const meta: ResponseMeta = { ...META };

    toSuccessEnvelope(data, meta);

    expect(data).toEqual({ id: 'abc' });
    expect(meta).toEqual(META);
  });
});

describe('successEnvelopeSchema', () => {
  const schema = successEnvelopeSchema(apiKeySchema);

  it('parses a real { data, meta } response body', () => {
    const parsed: ApiEnvelope<ApiKey> = schema.parse({
      data: VALID_KEY,
      meta: META,
    });

    expect(parsed.data?.identifier).toBe('vapi-prod');
    expect(parsed.meta.requestId).toBe(META.requestId);
  });

  it('parses a body whose data is null', () => {
    const parsed = schema.parse({ data: null, meta: META });

    expect(parsed.data).toBeNull();
  });

  it('accepts an empty list with a paginated meta', () => {
    const parsed = successEnvelopeSchema(apiKeyListSchema).parse({
      data: [],
      meta: PAGINATED_META,
    });

    expect(parsed.data).toEqual([]);
    expect(parsed.meta.pagination?.totalPages).toBe(3);
  });

  it('rejects a body without data', () => {
    expect(() => schema.parse({ meta: META })).toThrow();
  });

  it('rejects a body without meta', () => {
    expect(() => schema.parse({ data: VALID_KEY })).toThrow();
  });

  it('rejects a malformed payload inside data', () => {
    expect(() =>
      schema.parse({ data: { ...VALID_KEY, name: '' }, meta: META }),
    ).toThrow();
  });

  it('strips an unknown key inside data instead of failing', () => {
    const parsed = schema.parse({
      data: { ...VALID_KEY, futureField: 'x' },
      meta: META,
    });

    expect(Object.keys(parsed.data ?? {})).not.toContain('futureField');
  });

  it('rejects a meta timestamp without a timezone', () => {
    expect(() =>
      schema.parse({
        data: VALID_KEY,
        meta: { ...META, timestamp: '2026-10-26T15:21:48' },
      }),
    ).toThrow();
  });

  it('rejects an empty requestId', () => {
    expect(() =>
      schema.parse({ data: VALID_KEY, meta: { ...META, requestId: '' } }),
    ).toThrow();
  });

  it('rejects an explicit null pagination (absent, never null)', () => {
    expect(() =>
      schema.parse({ data: VALID_KEY, meta: { ...META, pagination: null } }),
    ).toThrow();
  });
});

describe('responseMetaSchema', () => {
  it('accepts the minimal meta', () => {
    expect(responseMetaSchema.parse(META)).toEqual(META);
  });

  it('rejects a pagination without totalPages', () => {
    expect(() =>
      responseMetaSchema.parse({
        ...META,
        pagination: { page: 1, limit: 20, total: 42 },
      }),
    ).toThrow();
  });
});

describe('paginationMetaSchema', () => {
  it('accepts a zeroed pagination for an empty result set', () => {
    expect(
      paginationMetaSchema.parse({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      }),
    ).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it('rejects a page below 1', () => {
    expect(() =>
      paginationMetaSchema.parse({
        page: 0,
        limit: 20,
        total: 0,
        totalPages: 0,
      }),
    ).toThrow();
  });

  it('rejects a limit of 0', () => {
    expect(() =>
      paginationMetaSchema.parse({
        page: 1,
        limit: 0,
        total: 0,
        totalPages: 0,
      }),
    ).toThrow();
  });

  it('rejects a fractional page', () => {
    expect(() =>
      paginationMetaSchema.parse({
        page: 1.5,
        limit: 20,
        total: 0,
        totalPages: 0,
      }),
    ).toThrow();
  });
});
