import { toQueryString } from '../src/query-string.logic.js';

/**
 * Unit tests for `src/query-string.logic.ts` (AIS-109).
 *
 * The function exists because a filter record is full of “not chosen yet” values
 * (`undefined`, `null`, `''`, `[]`). Every case below is one of those, plus the
 * encoding rules the API relies on: a repeated key for an array, and the
 * `application/x-www-form-urlencoded` encoding `URLSearchParams` produces.
 */

describe('toQueryString', () => {
  it('returns an empty string when there is no filter', () => {
    expect(toQueryString({})).toBe('');
  });

  it('omits undefined, null and empty-string values', () => {
    expect(toQueryString({ q: undefined, sort: null, tag: '' })).toBe('');
  });

  it('omits an empty array', () => {
    expect(toQueryString({ tag: [] })).toBe('');
  });

  it('keeps a string value', () => {
    expect(toQueryString({ q: 'vapi' })).toBe('q=vapi');
  });

  it('stringifies a number', () => {
    expect(toQueryString({ limit: 20 })).toBe('limit=20');
  });

  it('stringifies a boolean', () => {
    expect(toQueryString({ active: false })).toBe('active=false');
  });

  it('keeps the zero value instead of dropping it as falsy', () => {
    expect(toQueryString({ page: 0 })).toBe('page=0');
  });

  it('repeats the key for every array element', () => {
    expect(toQueryString({ tag: ['a', 'b'] })).toBe('tag=a&tag=b');
  });

  it('drops an empty string inside an array', () => {
    expect(toQueryString({ tag: ['a', ''] })).toBe('tag=a');
  });

  it('percent-encodes a reserved character', () => {
    expect(toQueryString({ q: 'a&b' })).toBe('q=a%26b');
  });

  it('percent-encodes a non-ASCII character', () => {
    expect(toQueryString({ q: 'é' })).toBe('q=%C3%A9');
  });

  it('encodes a space the way URLSearchParams does', () => {
    expect(toQueryString({ q: 'a b' })).toBe('q=a+b');
  });

  it('keeps the insertion order of the filters', () => {
    expect(toQueryString({ b: '2', a: '1' })).toBe('b=2&a=1');
  });

  it('omits a value that equals its default', () => {
    expect(toQueryString({ page: 1, limit: 50 }, { page: 1 })).toBe('limit=50');
  });

  it('keeps a value that differs from its default', () => {
    expect(toQueryString({ page: 2 }, { page: 1 })).toBe('page=2');
  });

  it('keeps a value whose key has no default entry', () => {
    expect(toQueryString({ page: 2 }, { limit: 20 })).toBe('page=2');
  });

  it('keeps an array even when a scalar default shares its key', () => {
    expect(toQueryString({ tag: ['a'] }, { tag: 'a' })).toBe('tag=a');
  });

  it('does not treat an inherited property as a default', () => {
    const defaults = Object.create({ page: 1 }) as Record<string, number>;

    expect(toQueryString({ page: 1 }, defaults)).toBe('page=1');
  });
});
