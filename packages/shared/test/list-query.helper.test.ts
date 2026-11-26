import { toListQueryParams } from '../src/contract/list-query.helper.js';

/**
 * The resource-filter half of `toListQueryParams` (AIS-178/c).
 *
 * Deliberately a sibling of `list-query-helper.test.ts` and not a replacement:
 * that file owns the omission rule of the five paging fields and
 * `mergeListQuery`, this one owns the behaviour added for the `customers` list —
 * the pass-through of filters that are **not** part of the generic list query.
 *
 * Why it exists at all: before this change the builder wrote only `page`,
 * `limit`, `order`, `q` and `sort`, so `?status=active` was silently dropped on
 * its way to the server and the caller received an unfiltered page. A dropped
 * filter is a lie the client cannot see, which is exactly the kind of defect a
 * test has to pin down.
 */

/** An `interface`-shaped query — the case an index signature would reject. */
interface PaginatedQuery {
  readonly page: number;
  readonly limit: number;
  readonly order: 'asc' | 'desc';
  readonly status?: string;
}

describe('toListQueryParams — resource filters (AIS-178/c)', () => {
  it('appends the extra filters after the paging block', () => {
    const search = toListQueryParams({
      page: 2,
      limit: 50,
      order: 'asc',
      status: 'active',
      type: 'company',
      source: 'referral',
    }).toString();

    expect(search).toBe(
      'page=2&limit=50&order=asc&status=active&type=company&source=referral',
    );
  });

  it('omits a filter that is undefined', () => {
    const search = toListQueryParams({
      page: 1,
      limit: 20,
      order: 'desc',
      status: undefined,
    }).toString();

    expect(search).toBe('');
  });

  it('omits a filter that is null', () => {
    const search = toListQueryParams({
      page: 1,
      limit: 20,
      order: 'desc',
      status: null,
    }).toString();

    expect(search).toBe('');
  });

  it('omits a filter that is an empty string', () => {
    const search = toListQueryParams({
      page: 1,
      limit: 20,
      order: 'desc',
      status: '',
    }).toString();

    expect(search).toBe('');
  });

  it('stringifies a numeric and a boolean filter', () => {
    const search = toListQueryParams({
      page: 1,
      limit: 20,
      order: 'desc',
      hasMissingData: true,
      pageSize: 5,
    }).toString();

    expect(search).toBe('hasMissingData=true&pageSize=5');
  });

  it('never writes a paging key twice', () => {
    const search = toListQueryParams({ page: 4, limit: 20, order: 'desc' }).toString();

    expect(search).toBe('page=4');
  });

  it('keeps the filters in insertion order', () => {
    const search = toListQueryParams({
      page: 1,
      limit: 20,
      order: 'desc',
      status: 'active',
      type: 'company',
    }).toString();

    expect(search).toBe('status=active&type=company');
  });

  it('accepts an interface-shaped query that carries a filter', () => {
    const query: PaginatedQuery = {
      page: 1,
      limit: 20,
      order: 'desc',
      status: 'active',
    };

    expect(toListQueryParams(query).toString()).toBe('status=active');
  });
});
