import {
  API_KEY_DEFAULT_SORT,
  API_KEY_LIST_QUERY_PARAMETERS,
  API_KEY_SORT_FIELDS,
  API_KEY_SORT_PARAMETER,
  apiKeyListQuerySchema,
} from '../src/contract/api-keys/api-keys.list-query.js';
import {
  LIST_QUERY_DEFAULT_LIMIT,
  LIST_QUERY_MAX_LIMIT,
} from '../src/contract/list-query.schema.js';
import type { ApiKeyListQuery } from '../src/contract/api-keys/api-keys.list-query.js';

/**
 * Unit tests for the `api-keys` list query (AIS-107).
 *
 * Two things are proven here, and both are contract properties rather than
 * implementation details:
 *
 * - the server's `ZodQueryPipe` receives exactly the shape the client builds
 *   (defaults filled in, `sort` restricted to the allow-list, empty `q` gone);
 * - the published OpenAPI parameters describe the **same** bounds, because they
 *   are derived from the same constants.
 */

describe('apiKeyListQuerySchema', () => {
  it('fills every default when the query string is empty', () => {
    const parsed: ApiKeyListQuery = apiKeyListQuerySchema.parse({});

    expect(parsed).toEqual({
      page: 1,
      limit: LIST_QUERY_DEFAULT_LIMIT,
      order: 'desc',
      sort: API_KEY_DEFAULT_SORT,
    });
  });

  it('coerces the paging fields, which always arrive as strings', () => {
    const parsed = apiKeyListQuerySchema.parse({ page: '2', limit: '10' });

    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
  });

  it('accepts every sortable column', () => {
    for (const field of API_KEY_SORT_FIELDS) {
      expect(apiKeyListQuerySchema.parse({ sort: field }).sort).toBe(field);
    }
  });

  it('rejects a column outside the allow-list, so it never reaches the SQL', () => {
    const result = apiKeyListQuerySchema.safeParse({ sort: 'passwordHash' });

    expect(result.success).toBe(false);
  });

  it('rejects a page above the maximum page size', () => {
    const result = apiKeyListQuerySchema.safeParse({
      limit: String(LIST_QUERY_MAX_LIMIT + 1),
    });

    expect(result.success).toBe(false);
  });

  it('rejects a page size of zero', () => {
    expect(apiKeyListQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('rejects a fractional page number', () => {
    expect(apiKeyListQuerySchema.safeParse({ page: '1.5' }).success).toBe(false);
  });

  it('rejects an unknown sort direction', () => {
    expect(apiKeyListQuerySchema.safeParse({ order: 'sideways' }).success).toBe(
      false,
    );
  });

  it('drops an empty search term instead of filtering on it', () => {
    expect(apiKeyListQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });

  it('trims a search term', () => {
    expect(apiKeyListQuerySchema.parse({ q: '  vapi  ' }).q).toBe('vapi');
  });
});

describe('API_KEY_LIST_QUERY_PARAMETERS', () => {
  it('documents page, limit, sort, order and q in that order', () => {
    expect(API_KEY_LIST_QUERY_PARAMETERS.map((entry) => entry.name)).toEqual([
      'page',
      'limit',
      'sort',
      'order',
      'q',
    ]);
  });

  it('documents the same page-size bound the schema enforces', () => {
    const limit = API_KEY_LIST_QUERY_PARAMETERS.find(
      (entry) => entry.name === 'limit',
    );

    expect(limit?.schema['maximum']).toBe(LIST_QUERY_MAX_LIMIT);
    expect(limit?.schema['default']).toBe(LIST_QUERY_DEFAULT_LIMIT);
  });

  it('documents exactly the sortable columns', () => {
    expect(API_KEY_SORT_PARAMETER.schema['enum']).toEqual([
      ...API_KEY_SORT_FIELDS,
    ]);
    expect(API_KEY_SORT_PARAMETER.schema['default']).toBe(API_KEY_DEFAULT_SORT);
  });

  it('marks every list parameter optional', () => {
    for (const entry of API_KEY_LIST_QUERY_PARAMETERS) {
      expect(entry.required).toBe(false);
    }
  });
});
