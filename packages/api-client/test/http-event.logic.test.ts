/**
 * Tests of the event derivation (AIS-152).
 *
 * The three helpers decide what a listener may see, so they are asserted with
 * plain values: no `fetch`, no client, no store. Every privacy rule (masked
 * secret, truncated query, validated meta) is one branch here.
 */

import {
  HTTP_BODY_PREVIEW_MAX_LENGTH,
  HTTP_PREVIEW_REDACTED_PLACEHOLDER,
  HTTP_QUERY_MAX_LENGTH,
} from '../src/http-event.const.js';
import {
  toBodyPreview,
  toEventQuery,
  toResponseMeta,
} from '../src/http-event.logic.js';
import { TEST_META, TEST_PAGINATION, paginatedMeta } from './mocks/fetch.mock.js';

/** @returns a string of the given length, to test the limits exactly. */
function repeat(character: string, length: number): string {
  return character.repeat(length);
}

describe('toEventQuery', () => {
  it('returns an empty string for a path without a query', () => {
    expect(toEventQuery('/items')).toBe('');
  });

  it('keeps the generated list query in order', () => {
    expect(toEventQuery('/items?page=1&limit=20')).toBe('page=1&limit=20');
  });

  it('truncates an over-long query with a visible suffix', () => {
    const long = repeat('a', HTTP_QUERY_MAX_LENGTH + 10);

    const query = toEventQuery(`/items?q=${long}`);

    expect(query).toHaveLength(HTTP_QUERY_MAX_LENGTH + 1);
    expect(query.endsWith('…')).toBe(true);
  });
});

describe('toBodyPreview', () => {
  it('returns null when the call carried no body', () => {
    expect(toBodyPreview(undefined)).toBeNull();
  });

  it('serialises a plain payload as it was sent', () => {
    expect(toBodyPreview({ name: 'first' })).toBe('{"name":"first"}');
  });

  it('masks a sensitive top-level key before serialising', () => {
    const preview = toBodyPreview({ name: 'first', token: 'super-secret' });

    expect(preview).not.toContain('super-secret');
    expect(preview).toContain(HTTP_PREVIEW_REDACTED_PLACEHOLDER);
  });

  it('masks an api key and a password as well', () => {
    const preview = toBodyPreview({ apiKey: 'k-1', password: 'p-1' });

    expect(preview).not.toContain('k-1');
    expect(preview).not.toContain('p-1');
  });

  it('truncates an over-long body with a visible suffix', () => {
    const preview = toBodyPreview({ name: repeat('a', HTTP_BODY_PREVIEW_MAX_LENGTH + 50) });

    expect(preview).toHaveLength(HTTP_BODY_PREVIEW_MAX_LENGTH + 1);
    expect(preview?.endsWith('…')).toBe(true);
  });

  it('returns null instead of throwing for an unserialisable body', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    expect(toBodyPreview(circular)).toBeNull();
    expect(toBodyPreview({ big: BigInt(1) })).toBeNull();
  });
});

describe('toResponseMeta', () => {
  it('reads requestId, timestamp and totalItems of a paginated envelope', () => {
    expect(toResponseMeta({ data: [], meta: paginatedMeta() })).toEqual({
      requestId: TEST_META.requestId,
      timestamp: TEST_META.timestamp,
      totalItems: TEST_PAGINATION.total,
    });
  });

  it('reports totalItems as null when the endpoint does not paginate', () => {
    expect(toResponseMeta({ data: null, meta: TEST_META })?.totalItems).toBeNull();
  });

  it('returns null when the body carries no meta', () => {
    expect(toResponseMeta({ id: '1' })).toBeNull();
    expect(toResponseMeta(null)).toBeNull();
    expect(toResponseMeta('body')).toBeNull();
  });

  it('returns null when the meta does not satisfy the shared schema', () => {
    expect(toResponseMeta({ meta: { requestId: '' } })).toBeNull();
  });
});
