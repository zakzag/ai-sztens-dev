/**
 * Branch-by-branch tests of the breadcrumb derivation (AIS-146).
 *
 * The logic is pure, so the tests need no router and no DOM: they hand in a
 * fixture registry and a pathname and assert the resulting trail.
 */

import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  MOCK_CRUMB_CYCLE_A_LABEL,
  MOCK_CRUMB_CYCLE_A_PATH,
  MOCK_CRUMB_CYCLE_B_LABEL,
  MOCK_CRUMB_DETAIL_PATH,
  MOCK_CRUMB_LIST_LABEL,
  MOCK_CRUMB_LIST_PATH,
  MOCK_CRUMB_ORPHAN_LABEL,
  MOCK_CRUMB_ORPHAN_PATH,
  MOCK_CRUMB_PLAIN_DETAIL_PATH,
  MOCK_CRUMB_ROOT_LABEL,
  MOCK_CRUMB_ROOT_PATH,
  MOCK_CRUMB_ROUTES,
  MOCK_CRUMB_STATIC_LABEL_DETAIL_LABEL,
  MOCK_CRUMB_STATIC_LABEL_DETAIL_PATH,
} from '../../test/mocks/breadcrumb-routes.mock.js';
import { interpolatePath, matchRoute, toBreadcrumbItems } from './breadcrumb.logic.js';
import type { RouteEntry } from './route-entry.interface.js';

/** A minimal entry helper for the ad-hoc registries of single tests. */
function entry(
  path: string,
  breadcrumbLabel: string | null,
  breadcrumbParentPath?: string,
  resolveBreadcrumbLabel?: (params: Readonly<Record<string, string>>) => string,
): RouteEntry {
  return {
    path,
    navLabel: null,
    // `createElement` instead of JSX: this file stays `.ts`, because the logic
    // it tests has nothing to do with rendering.
    element: createElement('p', null, path),
    protected: true,
    breadcrumbLabel,
    breadcrumbParentPath,
    resolveBreadcrumbLabel,
  };
}

describe('toBreadcrumbItems', () => {
  it('renders the root as a single crumb without a link', () => {
    expect(toBreadcrumbItems(MOCK_CRUMB_ROUTES, MOCK_CRUMB_ROOT_PATH)).toEqual([
      { label: MOCK_CRUMB_ROOT_LABEL },
    ]);
  });

  it('links every crumb but the current page', () => {
    expect(toBreadcrumbItems(MOCK_CRUMB_ROUTES, MOCK_CRUMB_LIST_PATH)).toEqual([
      { label: MOCK_CRUMB_ROOT_LABEL, to: MOCK_CRUMB_ROOT_PATH },
      { label: MOCK_CRUMB_LIST_LABEL },
    ]);
  });

  it('resolves the label of a dynamic route from its params', () => {
    expect(
      toBreadcrumbItems(MOCK_CRUMB_ROUTES, '/api-keys/abc123'),
    ).toEqual([
      { label: MOCK_CRUMB_ROOT_LABEL, to: MOCK_CRUMB_ROOT_PATH },
      { label: MOCK_CRUMB_LIST_LABEL, to: MOCK_CRUMB_LIST_PATH },
      { label: 'abc123' },
    ]);
  });

  it('treats a trailing slash as the same path', () => {
    expect(toBreadcrumbItems(MOCK_CRUMB_ROUTES, `${MOCK_CRUMB_LIST_PATH}/`)).toEqual(
      toBreadcrumbItems(MOCK_CRUMB_ROUTES, MOCK_CRUMB_LIST_PATH),
    );
  });

  it('decodes an escaped segment the way the router does', () => {
    const items = toBreadcrumbItems(MOCK_CRUMB_ROUTES, '/api-keys/a%20b');

    expect(items.at(-1)).toEqual({ label: 'a b' });
  });

  it('shows a malformed escape verbatim instead of throwing', () => {
    const items = toBreadcrumbItems(MOCK_CRUMB_ROUTES, '/api-keys/%E0%A4%A');

    expect(items.at(-1)).toEqual({ label: '%E0%A4%A' });
  });

  it('skips an entry without a crumb but keeps its parent chain', () => {
    expect(
      toBreadcrumbItems(MOCK_CRUMB_ROUTES, '/plain/xyz'),
    ).toEqual([
      { label: MOCK_CRUMB_ROOT_LABEL, to: MOCK_CRUMB_ROOT_PATH },
      { label: 'xyz' },
    ]);
  });

  it('stops at a parent path that names no entry, without throwing', () => {
    expect(toBreadcrumbItems(MOCK_CRUMB_ROUTES, MOCK_CRUMB_ORPHAN_PATH)).toEqual([
      { label: MOCK_CRUMB_ORPHAN_LABEL },
    ]);
  });

  it('stops on a parent cycle and returns a finite trail', () => {
    expect(toBreadcrumbItems(MOCK_CRUMB_ROUTES, MOCK_CRUMB_CYCLE_A_PATH)).toEqual([
      { label: MOCK_CRUMB_CYCLE_B_LABEL, to: '/cycle-b' },
      { label: MOCK_CRUMB_CYCLE_A_LABEL },
    ]);
  });

  it('returns no crumbs for an unknown path', () => {
    expect(toBreadcrumbItems(MOCK_CRUMB_ROUTES, '/nope')).toEqual([]);
  });

  it('never builds a trail from the catch-all entry', () => {
    const routes: readonly RouteEntry[] = [
      entry('*', 'Nem található'),
      entry(MOCK_CRUMB_ROOT_PATH, MOCK_CRUMB_ROOT_LABEL),
    ];

    expect(toBreadcrumbItems(routes, '/nope')).toEqual([]);
  });

  it('prefers a static path over a matching parameter template', () => {
    const routes: readonly RouteEntry[] = [
      entry(MOCK_CRUMB_DETAIL_PATH, null, MOCK_CRUMB_LIST_PATH, (params) => params.identifier),
      entry(MOCK_CRUMB_LIST_PATH, MOCK_CRUMB_LIST_LABEL, MOCK_CRUMB_ROOT_PATH),
      entry(MOCK_CRUMB_ROOT_PATH, MOCK_CRUMB_ROOT_LABEL),
    ];

    expect(toBreadcrumbItems(routes, MOCK_CRUMB_LIST_PATH)).toEqual([
      { label: MOCK_CRUMB_ROOT_LABEL, to: MOCK_CRUMB_ROOT_PATH },
      { label: MOCK_CRUMB_LIST_LABEL },
    ]);
  });

  it('uses the static label of a dynamic route that has no resolver', () => {
    expect(
      toBreadcrumbItems(MOCK_CRUMB_ROUTES, '/labelled/42'),
    ).toEqual([
      { label: MOCK_CRUMB_ROOT_LABEL, to: MOCK_CRUMB_ROOT_PATH },
      { label: MOCK_CRUMB_STATIC_LABEL_DETAIL_LABEL },
    ]);
  });

  it('renders a parent without a link when its template param is unknown', () => {
    // The leaf captures `a` only, so the parent template `/y/:b` cannot be
    // filled — a link there would point at a literal `:b`.
    const routes: readonly RouteEntry[] = [
      entry('/y/:b', 'Szülő'),
      entry('/x/:a', null, '/y/:b', (params) => params.a),
    ];

    expect(toBreadcrumbItems(routes, '/x/42')).toEqual([
      { label: 'Szülő' },
      { label: '42' },
    ]);
  });

  it('hands the matched params to the resolver', () => {
    const resolveBreadcrumbLabel = vi.fn(() => 'FELOLDVA');
    const routes: readonly RouteEntry[] = [
      entry('/x/:a/:b', null, undefined, resolveBreadcrumbLabel),
    ];

    const items = toBreadcrumbItems(routes, '/x/one/two');

    expect(resolveBreadcrumbLabel).toHaveBeenCalledWith({ a: 'one', b: 'two' });
    expect(items).toEqual([{ label: 'FELOLDVA' }]);
  });
});

describe('matchRoute', () => {
  it('returns the entry and its params for a dynamic path', () => {
    const matched = matchRoute(MOCK_CRUMB_ROUTES, '/api-keys/abc123');

    expect(matched?.entry.path).toBe(MOCK_CRUMB_DETAIL_PATH);
    expect(matched?.params).toEqual({ identifier: 'abc123' });
  });

  it('returns no params for a static path', () => {
    const matched = matchRoute(MOCK_CRUMB_ROUTES, MOCK_CRUMB_ROOT_PATH);

    expect(matched?.entry.path).toBe(MOCK_CRUMB_ROOT_PATH);
    expect(matched?.params).toEqual({});
  });

  it('returns null for an unknown path', () => {
    expect(matchRoute(MOCK_CRUMB_ROUTES, '/nope')).toBeNull();
  });

  it('does not select an entry with a different segment count', () => {
    expect(matchRoute(MOCK_CRUMB_ROUTES, '/api-keys/abc/extra')).toBeNull();
  });

  it('does not select a dynamic entry whose literal segments differ', () => {
    expect(matchRoute(MOCK_CRUMB_ROUTES, '/api-key/abc123')).toBeNull();
  });

  it('keeps the plain template intact when the leaf has no resolver branch', () => {
    // `MOCK_CRUMB_PLAIN_DETAIL_PATH` has a resolver; this asserts the matcher is
    // independent of it and still captures the param.
    const matched = matchRoute(MOCK_CRUMB_ROUTES, '/plain/xyz');

    expect(matched?.entry.path).toBe(MOCK_CRUMB_PLAIN_DETAIL_PATH);
    expect(matched?.params).toEqual({ id: 'xyz' });
  });

  it('matches a static-label dynamic route', () => {
    const matched = matchRoute(MOCK_CRUMB_ROUTES, '/labelled/42');

    expect(matched?.params).toEqual({ id: '42' });
    expect(matched?.entry.path).toBe(MOCK_CRUMB_STATIC_LABEL_DETAIL_PATH);
  });
});

describe('interpolatePath', () => {
  it('fills a known param', () => {
    expect(interpolatePath('/api-keys/:identifier', { identifier: 'abc' })).toBe(
      '/api-keys/abc',
    );
  });

  it('fills several params', () => {
    expect(interpolatePath('/a/:b/c/:d', { b: '1', d: '2' })).toBe('/a/1/c/2');
  });

  it('returns undefined when a param is missing', () => {
    expect(interpolatePath('/api-keys/:identifier', {})).toBeUndefined();
  });

  it('keeps a static template untouched', () => {
    expect(interpolatePath('/api-keys', {})).toBe('/api-keys');
  });

  it('keeps the root path intact', () => {
    expect(interpolatePath(MOCK_CRUMB_ROOT_PATH, {})).toBe(MOCK_CRUMB_ROOT_PATH);
  });
});
