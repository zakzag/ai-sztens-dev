/**
 * Tests of the pure list-params rules (AIS-119).
 *
 * No router is mounted: the fallback behaviour and the URL building are proven
 * with plain values, exactly as they are defined in `use-list-params.logic.ts`.
 */

import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { createListQuerySchema, listQuerySchema } from '@callback/shared';
import type {
  ListParams,
  ListParamsSchema,
} from './use-list-params.interface.js';
import {
  applyPageReset,
  ListParamsError,
  parseListParams,
  parseListParamsDefaults,
  toListParamsDefaults,
  toListParamsUrlSearchParams,
} from './use-list-params.logic.js';

describe('parseListParams', () => {
  it('parses a valid URL into the typed query', () => {
    const params = parseListParams(
      listQuerySchema,
      new URLSearchParams('page=3&limit=50&order=asc&q=abc'),
    );

    expect(params).toEqual({ page: 3, limit: 50, order: 'asc', q: 'abc' });
  });

  it('falls back to defaults for an out-of-range limit', () => {
    const params = parseListParams(
      listQuerySchema,
      new URLSearchParams('limit=999'),
    );

    expect(params.limit).toBe(20);
    expect(params.page).toBe(1);
  });

  it('falls back to defaults for a non-numeric page', () => {
    const params = parseListParams(
      listQuerySchema,
      new URLSearchParams('page=abc'),
    );

    expect(params.page).toBe(1);
  });

  it('treats an empty q as undefined', () => {
    const params = parseListParams(listQuerySchema, new URLSearchParams('q='));

    expect(params.q).toBeUndefined();
  });

  it('keeps a non-default sort with a resource schema', () => {
    const schema = createListQuerySchema(['name', 'createdAt'], 'createdAt');
    const params = parseListParams(schema, new URLSearchParams('sort=name'));

    expect(params.sort).toBe('name');
  });
});

describe('parseListParamsDefaults', () => {
  it('returns the schema defaults for an empty record', () => {
    expect(parseListParamsDefaults(listQuerySchema)).toEqual({
      page: 1,
      limit: 20,
      order: 'desc',
      q: undefined,
    });
  });

  it('throws ListParamsError when the schema cannot default an empty record', () => {
    const brokenSchema = z.object({
      page: z.number(),
    }) as unknown as ListParamsSchema<ListParams>;

    expect(() => parseListParamsDefaults(brokenSchema)).toThrow(
      ListParamsError,
    );
  });
});

describe('applyPageReset', () => {
  const query: ListParams = {
    page: 3,
    limit: 20,
    order: 'desc',
    q: undefined,
  };

  it('resets the page when a non-page field changes', () => {
    expect(applyPageReset(query, 'q')).toEqual({ ...query, page: 1 });
  });

  it('keeps the page when the page itself changes', () => {
    expect(applyPageReset(query, 'page')).toEqual(query);
  });
});

describe('toListParamsDefaults', () => {
  it('derives the base defaults from the parsed query', () => {
    const defaults = toListParamsDefaults(
      parseListParamsDefaults(listQuerySchema),
    );

    expect(defaults).toEqual({ limit: 20, order: 'desc' });
  });

  it('carries the resource sort default', () => {
    const schema = createListQuerySchema(['name', 'createdAt'], 'createdAt');
    const defaults = toListParamsDefaults(parseListParamsDefaults(schema));

    expect(defaults.sort).toBe('createdAt');
  });
});

describe('toListParamsUrlSearchParams', () => {
  it('omits every default value', () => {
    const defaults = toListParamsDefaults(
      parseListParamsDefaults(listQuerySchema),
    );
    const url = toListParamsUrlSearchParams(
      parseListParamsDefaults(listQuerySchema),
      defaults,
    );

    expect(url.toString()).toBe('');
  });

  it('writes only the non-default values', () => {
    const url = toListParamsUrlSearchParams(
      { page: 3, limit: 20, order: 'asc', q: 'abc' },
      { limit: 20, order: 'desc' },
    );

    expect(url.toString()).toBe('page=3&order=asc&q=abc');
  });
});
