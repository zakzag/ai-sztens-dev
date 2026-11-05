/**
 * Tests of the URL-owned list-params hook (AIS-119).
 *
 * Each test mounts the hook inside a memory router (via
 * `renderHookWithRouter`) and asserts both the parsed `params` and the URL the
 * hook actually wrote, which is what makes the URL-ownership guarantee
 * observable.
 */

import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createListQuerySchema, listQuerySchema } from '@callback/shared';
import { renderHookWithRouter } from '../../test/mocks/app-router.mock.js';
import { useListParams } from './use-list-params.js';

describe('useListParams', () => {
  it('reads the page from the URL', () => {
    const { result } = renderHookWithRouter(
      () => useListParams(listQuerySchema),
      { initialEntries: ['/api-keys?page=3'] },
    );

    expect(result.current.params.page).toBe(3);
  });

  it('falls back to defaults for invalid params without throwing', () => {
    const { result } = renderHookWithRouter(
      () => useListParams(listQuerySchema),
      { initialEntries: ['/api-keys?limit=999&page=abc'] },
    );

    expect(result.current.params.limit).toBe(20);
    expect(result.current.params.page).toBe(1);
  });

  it('writes a changed field to the URL and resets the page', () => {
    const { result, getSearch } = renderHookWithRouter(
      () => useListParams(listQuerySchema),
      { initialEntries: ['/api-keys?page=3'] },
    );

    act(() => {
      result.current.setParam('q', 'x');
    });

    const search = getSearch();
    expect(search).toContain('q=x');
    expect(search).not.toContain('page=3');
  });

  it('leaves default values out of the URL', () => {
    const { result, getSearch } = renderHookWithRouter(
      () => useListParams(listQuerySchema),
      { initialEntries: ['/api-keys'] },
    );

    act(() => {
      result.current.setParam('order', 'desc');
    });

    expect(getSearch()).not.toContain('order');
  });

  it('drops an invalid value back to its default', () => {
    const { result, getSearch } = renderHookWithRouter(
      () => useListParams(listQuerySchema),
      { initialEntries: ['/api-keys'] },
    );

    act(() => {
      result.current.setParam('limit', 999);
    });

    expect(result.current.params.limit).toBe(20);
    expect(getSearch()).not.toContain('limit=999');
  });

  it('resetParams clears the URL', () => {
    const { result, getSearch } = renderHookWithRouter(
      () => useListParams(listQuerySchema),
      { initialEntries: ['/api-keys?page=5&q=abc'] },
    );

    act(() => {
      result.current.resetParams();
    });

    expect(getSearch()).toBe('');
    expect(result.current.params.page).toBe(1);
  });

  it('keeps a non-default sort and drops the default one', () => {
    const schema = createListQuerySchema(['name', 'createdAt'], 'createdAt');
    const { result, getSearch } = renderHookWithRouter(
      () => useListParams(schema),
      { initialEntries: ['/api-keys?sort=name'] },
    );

    expect(result.current.params.sort).toBe('name');

    act(() => {
      result.current.setParam('sort', 'createdAt');
    });

    expect(getSearch()).not.toContain('sort');
  });

  it('writes a two-field patch as one URL state and resets the page', () => {
    const schema = createListQuerySchema(['name', 'createdAt'], 'createdAt');
    const { result, getSearch } = renderHookWithRouter(
      () => useListParams(schema),
      { initialEntries: ['/api-keys?page=3'] },
    );

    act(() => {
      result.current.setParams({ sort: 'name', order: 'asc' });
    });

    // Both fields in the same URL state is the proof of the single write
    // (AIS-116 D4): a second write built from the pre-render `params` would have
    // replaced the first, leaving only `order` behind.
    const searchParams = new URLSearchParams(getSearch());
    expect(searchParams.get('sort')).toBe('name');
    expect(searchParams.get('order')).toBe('asc');
    expect(searchParams.get('page')).toBeNull();
    expect(result.current.params.page).toBe(1);
  });

  it('drops an invalid patch value back to its default', () => {
    const { result, getSearch } = renderHookWithRouter(
      () => useListParams(listQuerySchema),
      { initialEntries: ['/api-keys'] },
    );

    act(() => {
      result.current.setParams({ limit: 999 });
    });

    expect(result.current.params.limit).toBe(20);
    expect(getSearch()).not.toContain('limit=999');
  });
});
