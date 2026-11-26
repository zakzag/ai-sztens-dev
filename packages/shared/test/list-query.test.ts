import {
  LIST_QUERY_DEFAULT_LIMIT,
  LIST_QUERY_MAX_LIMIT,
  LIST_QUERY_MAX_SEARCH_LENGTH,
  listQuerySchema,
} from '../src/contract/list-query.schema.js';

/**
 * Unit tests for `src/contract/list-query.schema.ts` (AIS-106).
 *
 * The list query is what the server validates and what the client builds, so
 * every branch is pinned here: the defaults, the coercion of the query string,
 * every boundary, the sort direction and the empty search term.
 *
 * The boundary cases matter most: they are the difference between a `400` with
 * a readable message and a `500` from the database.
 */

describe('listQuerySchema', () => {
  it('fills in the defaults for an empty query', () => {
    const parsed = listQuerySchema.parse({});

    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(LIST_QUERY_DEFAULT_LIMIT);
    expect(parsed.order).toBe('desc');
    expect(parsed.q).toBeUndefined();
  });

  it('coerces the page and the limit from the query string', () => {
    const parsed = listQuerySchema.parse({ page: '3', limit: '50' });

    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(50);
  });

  it('rejects a page below 1', () => {
    expect(() => listQuerySchema.parse({ page: '0' })).toThrow();
  });

  it('rejects a fractional page', () => {
    expect(() => listQuerySchema.parse({ page: '1.5' })).toThrow();
  });

  it('rejects a limit of 0', () => {
    expect(() => listQuerySchema.parse({ limit: '0' })).toThrow();
  });

  it('rejects a limit above the maximum', () => {
    expect(() =>
      listQuerySchema.parse({ limit: String(LIST_QUERY_MAX_LIMIT + 1) }),
    ).toThrow();
  });

  it('accepts the maximum limit', () => {
    const parsed = listQuerySchema.parse({
      limit: String(LIST_QUERY_MAX_LIMIT),
    });

    expect(parsed.limit).toBe(LIST_QUERY_MAX_LIMIT);
  });

  it('rejects an empty limit, because the coerced zero is below the minimum', () => {
    // `?limit=` arrives as an empty string; the coercion turns it into 0, which
    // is below the minimum - so the request is rejected instead of silently
    // becoming a one-page list.
    expect(() => listQuerySchema.parse({ limit: '' })).toThrow();
  });

  it('accepts both sort directions', () => {
    expect(listQuerySchema.parse({ order: 'asc' }).order).toBe('asc');
    expect(listQuerySchema.parse({ order: 'desc' }).order).toBe('desc');
  });

  it('rejects an unknown sort direction', () => {
    expect(() => listQuerySchema.parse({ order: 'sideways' })).toThrow();
  });

  it('trims the search term', () => {
    const parsed = listQuerySchema.parse({ q: '  acme  ' });

    expect(parsed.q).toBe('acme');
  });

  it('short-circuits an empty search term to undefined', () => {
    const parsed = listQuerySchema.parse({ q: '' });

    expect(parsed.q).toBeUndefined();
  });

  it('short-circuits a whitespace-only search term to undefined', () => {
    const parsed = listQuerySchema.parse({ q: '   ' });

    expect(parsed.q).toBeUndefined();
  });

  it('rejects a search term above the maximum length', () => {
    expect(() =>
      listQuerySchema.parse({
        q: 'a'.repeat(LIST_QUERY_MAX_SEARCH_LENGTH + 1),
      }),
    ).toThrow();
  });

  it('accepts a search term at the maximum length', () => {
    const q = 'a'.repeat(LIST_QUERY_MAX_SEARCH_LENGTH);

    expect(listQuerySchema.parse({ q }).q).toBe(q);
  });

  it('does not mutate the input it was given', () => {
    const input = { page: '2', limit: '10' };

    listQuerySchema.parse(input);

    expect(input).toEqual({ page: '2', limit: '10' });
  });
});
