/**
 * Tests of the entity query-key factory (AIS-175).
 *
 * The factory exists for one property: `invalidateQueries({ queryKey: all })`
 * must match every `list` and `detail` key of the same entity. TanStack Query
 * matches by prefix, so that property is exactly "the key starts with `all`" —
 * which is what these tests assert, along with the two failure modes the factory
 * removes: a namespace retyped per key, and a params object shared by reference.
 *
 * No React and no query client: plain values, like the module itself.
 */

import { describe, expect, it } from 'vitest';
import {
  ENTITY_QUERY_DETAIL_SEGMENT,
  ENTITY_QUERY_LIST_SEGMENT,
} from './create-entity-query-keys.const.js';
import { createEntityQueryKeys } from './create-entity-query-keys.js';

/** A stand-in list query; the factory never looks inside it. */
interface TestListParams {
  readonly page: number;
  readonly limit: number;
  readonly sort: string;
}

const NAMESPACE = 'test-entities';

const LIST_PARAMS: TestListParams = Object.freeze({
  page: 2,
  limit: 50,
  sort: 'name',
});

/**
 * Reproduces TanStack Query's prefix match: a query is matched by an
 * invalidation key when its own key starts with that key's elements.
 *
 * @param key - the query's cache key.
 * @param prefix - the invalidation key.
 * @returns `true` when the invalidation would refresh that query.
 */
function matchesPrefix(
  key: readonly unknown[],
  prefix: readonly unknown[],
): boolean {
  if (key.length < prefix.length) {
    return false;
  }

  return prefix.every((segment, index) => {
    const candidate = key[index];

    return JSON.stringify(candidate) === JSON.stringify(segment);
  });
}

describe('createEntityQueryKeys', () => {
  describe('all', () => {
    it('is the namespace on its own', () => {
      const keys = createEntityQueryKeys<TestListParams>(NAMESPACE);

      expect(keys.all).toEqual([NAMESPACE]);
    });
  });

  describe('list', () => {
    it('puts the params after the list segment', () => {
      const keys = createEntityQueryKeys<TestListParams>(NAMESPACE);

      expect(keys.list(LIST_PARAMS)).toEqual([
        NAMESPACE,
        ENTITY_QUERY_LIST_SEGMENT,
        LIST_PARAMS,
      ]);
    });

    it('uses the string segment "list"', () => {
      const keys = createEntityQueryKeys<TestListParams>(NAMESPACE);

      expect(keys.list(LIST_PARAMS)[1]).toBe('list');
    });

    it('produces a distinct key for every distinct query', () => {
      const keys = createEntityQueryKeys<TestListParams>(NAMESPACE);

      const firstPage = keys.list({ ...LIST_PARAMS, page: 1 });
      const secondPage = keys.list({ ...LIST_PARAMS, page: 2 });

      expect(firstPage).not.toEqual(secondPage);
    });

    it('produces the same key for two equal queries', () => {
      const keys = createEntityQueryKeys<TestListParams>(NAMESPACE);

      expect(keys.list({ ...LIST_PARAMS })).toEqual(keys.list({ ...LIST_PARAMS }));
    });

    it('copies the params instead of referencing them', () => {
      const keys = createEntityQueryKeys<TestListParams>(NAMESPACE);
      const mutable = { page: 1, limit: 20, sort: 'name' };

      const key = keys.list(mutable);

      expect(key[2]).not.toBe(mutable);
      expect(key[2]).toEqual(mutable);
    });

    it('keeps the key stable when the caller mutates its params object', () => {
      const keys = createEntityQueryKeys<TestListParams>(NAMESPACE);
      const mutable = { page: 1, limit: 20, sort: 'name' };

      const key = keys.list(mutable);
      const snapshot = { ...(key[2] as TestListParams) };

      mutable.page = 9;

      expect(key[2]).toEqual(snapshot);
      expect(key[2]).not.toEqual(mutable);
    });
  });

  describe('detail', () => {
    it('puts the identifier after the detail segment', () => {
      const keys = createEntityQueryKeys<TestListParams>(NAMESPACE);

      expect(keys.detail('abc-123')).toEqual([
        NAMESPACE,
        ENTITY_QUERY_DETAIL_SEGMENT,
        'abc-123',
      ]);
    });

    it('uses the string segment "detail"', () => {
      const keys = createEntityQueryKeys<TestListParams>(NAMESPACE);

      expect(keys.detail('abc-123')[1]).toBe('detail');
    });

    it('produces a distinct key per identifier', () => {
      const keys = createEntityQueryKeys<TestListParams>(NAMESPACE);

      expect(keys.detail('a')).not.toEqual(keys.detail('b'));
    });

    it('does not confuse an identifier with the list segment', () => {
      const keys = createEntityQueryKeys<TestListParams>(NAMESPACE);

      expect(keys.detail('list')).not.toEqual(keys.list(LIST_PARAMS));
    });
  });

  describe('prefix contract (the reason the factory exists)', () => {
    it('matches a list key with the all prefix', () => {
      const keys = createEntityQueryKeys<TestListParams>(NAMESPACE);

      expect(matchesPrefix(keys.list(LIST_PARAMS), keys.all)).toBe(true);
    });

    it('matches a detail key with the all prefix', () => {
      const keys = createEntityQueryKeys<TestListParams>(NAMESPACE);

      expect(matchesPrefix(keys.detail('abc-123'), keys.all)).toBe(true);
    });

    it('does not match a key of another namespace', () => {
      const first = createEntityQueryKeys<TestListParams>('first-entities');
      const second = createEntityQueryKeys<TestListParams>('second-entities');

      expect(matchesPrefix(second.list(LIST_PARAMS), first.all)).toBe(false);
      expect(matchesPrefix(second.detail('abc-123'), first.all)).toBe(false);
    });

    it('derives every key from the one namespace argument', () => {
      const keys = createEntityQueryKeys<TestListParams>('only-one-literal');

      expect(keys.all[0]).toBe('only-one-literal');
      expect(keys.list(LIST_PARAMS)[0]).toBe('only-one-literal');
      expect(keys.detail('abc-123')[0]).toBe('only-one-literal');
    });
  });
});
