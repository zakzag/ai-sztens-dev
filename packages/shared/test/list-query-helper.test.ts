import {
  LIST_QUERY_DEFAULTS,
  mergeListQuery,
  toListQueryParams,
  toPaginationMeta,
} from '../src/contract/list-query.helper.js';

/**
 * Unit tests for `src/contract/list-query.helper.ts` (AIS-106).
 *
 * The two helpers exist for the client: one merges a resource's filters into
 * the flat query without letting them move the user to another page, the other
 * builds the URL parameters and leaves out everything that is still at its
 * default — so `?page=1` never appears in the URL.
 */

describe('mergeListQuery', () => {
  it('keeps the flat fields and adds the filters', () => {
    const merged = mergeListQuery(
      { page: 2, limit: 20, order: 'desc', q: 'acme' },
      { status: 'active' },
    );

    expect(merged).toEqual({
      page: 2,
      limit: 20,
      order: 'desc',
      q: 'acme',
      status: 'active',
    });
  });

  it('never lets a filter overwrite the paging fields', () => {
    const merged = mergeListQuery({ page: 3, limit: 50, order: 'asc' }, {
      page: 99,
      limit: 999,
      order: 'desc',
    } as Record<string, unknown>);

    expect(merged.page).toBe(3);
    expect(merged.limit).toBe(50);
    expect(merged.order).toBe('asc');
  });

  it('omits an absent search term instead of writing undefined', () => {
    const merged = mergeListQuery(
      { page: 1, limit: 20, order: 'desc' },
      { status: 'active' },
    );

    expect('q' in merged).toBe(false);
  });

  it('keeps the sort column when there is one', () => {
    const merged = mergeListQuery(
      { page: 1, limit: 20, order: 'desc', sort: 'name' },
      { status: 'active' },
    );

    expect(merged.sort).toBe('name');
  });

  it('does not mutate the query it was given', () => {
    const query = { page: 1, limit: 20, order: 'desc' } as const;

    mergeListQuery(query, { status: 'active' });

    expect(query).toEqual({ page: 1, limit: 20, order: 'desc' });
  });
});

describe('toListQueryParams', () => {
  it('leaves out every field that is at its default', () => {
    const params = toListQueryParams({ page: 1, limit: 20, order: 'desc' });

    expect(params.toString()).toBe('');
  });

  it('writes the page when it is not the first one', () => {
    const params = toListQueryParams({ page: 3, limit: 20, order: 'desc' });

    expect(params.get('page')).toBe('3');
  });

  it('does not write page 1', () => {
    const params = toListQueryParams({ page: 1, limit: 20, order: 'desc' });

    expect(params.has('page')).toBe(false);
  });

  it('writes a changed limit', () => {
    const params = toListQueryParams({ page: 1, limit: 50, order: 'desc' });

    expect(params.get('limit')).toBe('50');
  });

  it('writes a changed sort direction', () => {
    const params = toListQueryParams({ page: 1, limit: 20, order: 'asc' });

    expect(params.get('order')).toBe('asc');
  });

  it('writes the search term', () => {
    const params = toListQueryParams({
      page: 1,
      limit: 20,
      order: 'desc',
      q: 'acme',
    });

    expect(params.get('q')).toBe('acme');
  });

  it('does not write an absent search term', () => {
    const params = toListQueryParams({
      page: 1,
      limit: 20,
      order: 'desc',
      q: undefined,
    });

    expect(params.has('q')).toBe(false);
  });

  it('does not write an empty search term', () => {
    const params = toListQueryParams({
      page: 1,
      limit: 20,
      order: 'desc',
      q: '',
    });

    expect(params.has('q')).toBe(false);
  });

  it('writes a sort column that differs from the default', () => {
    const params = toListQueryParams(
      { page: 1, limit: 20, order: 'desc', sort: 'name' },
      { ...LIST_QUERY_DEFAULTS, sort: 'createdAt' },
    );

    expect(params.get('sort')).toBe('name');
  });

  it('does not write the default sort column', () => {
    const params = toListQueryParams(
      { page: 1, limit: 20, order: 'desc', sort: 'createdAt' },
      { ...LIST_QUERY_DEFAULTS, sort: 'createdAt' },
    );

    expect(params.has('sort')).toBe(false);
  });

  it('builds a query string that round-trips through the schema', () => {
    const params = toListQueryParams({
      page: 2,
      limit: 50,
      order: 'asc',
      q: 'acme',
      sort: 'name',
    });

    expect(params.toString()).toBe(
      'page=2&limit=50&order=asc&q=acme&sort=name',
    );
  });
});

describe('toPaginationMeta', () => {
  it('computes totalPages from the page size and the total', () => {
    expect(toPaginationMeta({ page: 1, limit: 10 }, 12)).toEqual({
      page: 1,
      limit: 10,
      total: 12,
      totalPages: 2,
    });
  });

  it('reports zero pages when nothing matches', () => {
    expect(toPaginationMeta({ page: 1, limit: 20 }, 0)).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('does not invent a page for an exact division', () => {
    expect(toPaginationMeta({ page: 3, limit: 25 }, 75).totalPages).toBe(3);
  });

  it('echoes the requested page instead of clamping it to the last one', () => {
    // A page past the end is an empty slice of a real result set, not a 404 and
    // not a silent jump back to the last page.
    expect(toPaginationMeta({ page: 99, limit: 20 }, 42)).toEqual({
      page: 99,
      limit: 20,
      total: 42,
      totalPages: 3,
    });
  });

  it('treats a negative total as an empty result (defensive)', () => {
    expect(toPaginationMeta({ page: 1, limit: 20 }, -1).totalPages).toBe(0);
  });

  it('keeps a single full page at one page', () => {
    expect(toPaginationMeta({ page: 1, limit: 20 }, 20).totalPages).toBe(1);
  });
});
