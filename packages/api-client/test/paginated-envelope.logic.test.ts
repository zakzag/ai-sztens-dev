import { z } from 'zod';
import { unwrapPaginatedEnvelope } from '../src/paginated-envelope.logic.js';
import { TEST_META, paginatedMeta } from './mocks/fetch.mock.js';

/**
 * Unit tests for `src/paginated-envelope.logic.ts` (AIS-109).
 *
 * The contract being pinned: a list body is `{ data: rows, meta.pagination }`,
 * `null` rows are an empty page, and a body **without** `meta.pagination` is a
 * drift whose issue path is exactly `meta.pagination` — that path is what lets
 * the admin point at the pager instead of showing a generic panel.
 */

const rowSchema = z.object({ id: z.string(), name: z.string() });
const rowsSchema = z.array(rowSchema);

const ROW = { id: '1', name: 'first' };

describe('unwrapPaginatedEnvelope — success', () => {
  it('returns the rows and the pagination block', () => {
    const result = unwrapPaginatedEnvelope(rowsSchema, {
      data: [ROW],
      meta: paginatedMeta({ total: 42, totalPages: 3 }),
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toEqual([ROW]);
    expect(result.ok && result.meta.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 42,
      totalPages: 3,
    });
  });

  it('returns the request id and the timestamp of the envelope', () => {
    const result = unwrapPaginatedEnvelope(rowsSchema, {
      data: [],
      meta: paginatedMeta({ total: 0, totalPages: 0 }),
    });

    expect(result.ok && result.meta.requestId).toBe(TEST_META.requestId);
    expect(result.ok && result.meta.timestamp).toBe(TEST_META.timestamp);
  });

  it('accepts an empty page', () => {
    const result = unwrapPaginatedEnvelope(rowsSchema, {
      data: [],
      meta: paginatedMeta({ total: 0, totalPages: 0 }),
    });

    expect(result.ok && result.data).toEqual([]);
  });

  it('turns null rows into an empty array', () => {
    const result = unwrapPaginatedEnvelope(rowsSchema, {
      data: null,
      meta: paginatedMeta({ total: 0, totalPages: 0 }),
    });

    expect(result.ok && result.data).toEqual([]);
  });
});

describe('unwrapPaginatedEnvelope — drift', () => {
  it('rejects a body without `meta`', () => {
    const result = unwrapPaginatedEnvelope(rowsSchema, { data: [ROW] });

    expect(result.ok).toBe(false);
  });

  it('rejects a body without `meta.pagination` and reports its path', () => {
    const result = unwrapPaginatedEnvelope(rowsSchema, {
      data: [ROW],
      meta: TEST_META,
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues).toHaveLength(1);
    expect(result.ok === false && result.issues[0]?.path).toBe(
      'meta.pagination',
    );
  });

  it('rejects a row that does not match the schema', () => {
    const result = unwrapPaginatedEnvelope(rowsSchema, {
      data: [{ id: 1, name: 'first' }],
      meta: paginatedMeta(),
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues[0]?.path).toBe('0.id');
  });

  it('rejects a null body', () => {
    const result = unwrapPaginatedEnvelope(rowsSchema, null);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues.length).toBeGreaterThan(0);
  });

  it('keeps the zod error as the cause', () => {
    const result = unwrapPaginatedEnvelope(rowsSchema, { data: [] });

    expect(result.ok === false && result.cause.name).toBe('ZodError');
  });
});
