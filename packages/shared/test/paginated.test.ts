import { z } from 'zod';
import { apiKeySchema } from '../src/contract/api-keys/api-keys.schema.js';
import type { ApiKey } from '../src/contract/api-keys/api-keys.interface.js';
import type { ApiResult } from '../src/contract/api-result.interface.js';
import { paginatedSchema } from '../src/contract/paginated.schema.js';

/**
 * Unit tests for `src/contract/paginated.schema.ts` (AIS-106).
 *
 * The schema is the client's view of a list response. Two properties matter:
 * an empty list is a valid answer (with `total: 0`), and a response **without**
 * `meta.pagination` is a contract violation that must fail the parse — because
 * a client that silently treated it as "one page" would hide a broken server.
 */

const META = {
  requestId: '0192f3c4-0000-7000-8000-000000000000',
  timestamp: '2026-10-26T15:21:48.752Z',
};

const PAGINATED_META = {
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

describe('paginatedSchema', () => {
  const schema = paginatedSchema(z.array(apiKeySchema));

  it('parses a paginated list response', () => {
    const parsed: ApiResult<ApiKey[]> = schema.parse({
      data: [VALID_KEY],
      meta: PAGINATED_META,
    });

    expect(parsed.data).toHaveLength(1);
    expect(parsed.meta.pagination.total).toBe(42);
    expect(parsed.meta.pagination.totalPages).toBe(3);
  });

  it('keeps the request id and the timestamp of the envelope', () => {
    const parsed = schema.parse({ data: [], meta: PAGINATED_META });

    expect(parsed.meta.requestId).toBe(META.requestId);
    expect(parsed.meta.timestamp).toBe(META.timestamp);
  });

  it('accepts an empty list with a zeroed pagination', () => {
    const parsed = schema.parse({
      data: [],
      meta: {
        ...META,
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    });

    expect(parsed.data).toEqual([]);
    expect(parsed.meta.pagination.total).toBe(0);
    expect(parsed.meta.pagination.totalPages).toBe(0);
  });

  it('rejects a response without meta.pagination', () => {
    expect(() => schema.parse({ data: [], meta: META })).toThrow();
  });

  it('rejects a response without a meta at all', () => {
    expect(() => schema.parse({ data: [] })).toThrow();
  });

  it('rejects a malformed row inside data', () => {
    expect(() =>
      schema.parse({
        data: [{ ...VALID_KEY, name: '' }],
        meta: PAGINATED_META,
      }),
    ).toThrow();
  });

  it('rejects a pagination that is not an object', () => {
    expect(() =>
      schema.parse({ data: [], meta: { ...META, pagination: 'nope' } }),
    ).toThrow();
  });

  it('works with a plain schema, not only with the api-key one', () => {
    const plain = paginatedSchema(z.array(z.string()));

    const parsed = plain.parse({ data: ['a', 'b'], meta: PAGINATED_META });

    expect(parsed.data).toEqual(['a', 'b']);
  });
});
