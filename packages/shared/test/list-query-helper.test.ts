import {
  LIST_QUERY_DEFAULTS,
  mergeListQuery,
  toListQueryParams,
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
