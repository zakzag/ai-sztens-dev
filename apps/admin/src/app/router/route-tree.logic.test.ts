import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { flattenRouteEntries } from './route-tree.logic.js';
import type { RouteEntry } from './route-entry.interface.js';

/**
 * Unit tests of the route-tree flattening (AIS-155 `D3`).
 *
 * The function is the bridge between the registry tree and the flat consumers
 * (breadcrumb matcher, registry invariants), so the order and the completeness
 * of the result are both contractual.
 */

/**
 * @param path - the route path of the stub entry.
 * @param children - optional nested entries.
 * @returns a minimal registry entry for the tests.
 */
function toEntry(
  path: string,
  children?: readonly RouteEntry[],
): RouteEntry {
  return {
    path,
    navLabel: null,
    element: createElement('p'),
    protected: true,
    breadcrumbLabel: path,
    ...(children === undefined ? {} : { children }),
  };
}

describe('flattenRouteEntries', () => {
  it('returns an empty list for an empty registry', () => {
    expect(flattenRouteEntries([])).toEqual([]);
  });

  it('keeps a flat registry unchanged, in order', () => {
    const routes = [toEntry('/'), toEntry('/api-keys'), toEntry('/calls')];

    expect(flattenRouteEntries(routes).map((route) => route.path)).toEqual([
      '/',
      '/api-keys',
      '/calls',
    ]);
  });

  it('places every parent before its children, depth first', () => {
    const routes = [
      toEntry('/api-keys', [toEntry('/api-keys/new'), toEntry('/x')]),
      toEntry('/calls'),
    ];

    expect(flattenRouteEntries(routes).map((route) => route.path)).toEqual([
      '/api-keys',
      '/api-keys/new',
      '/x',
      '/calls',
    ]);
  });

  it('flattens more than one nesting level', () => {
    const routes = [
      toEntry('/a', [toEntry('/a/b', [toEntry('/a/b/c')])]),
    ];

    expect(flattenRouteEntries(routes).map((route) => route.path)).toEqual([
      '/a',
      '/a/b',
      '/a/b/c',
    ]);
  });

  it('handles an entry whose children list is empty', () => {
    const routes = [toEntry('/a', [])];

    expect(flattenRouteEntries(routes).map((route) => route.path)).toEqual([
      '/a',
    ]);
  });

  it('does not mutate the input tree', () => {
    const child = toEntry('/api-keys/new');
    const routes = [toEntry('/api-keys', [child])];

    flattenRouteEntries(routes);

    expect(routes[0]?.children).toEqual([child]);
  });

  it('declares every path exactly once for a well-formed tree', () => {
    const routes = [
      toEntry('/api-keys', [toEntry('/api-keys/new'), toEntry('/api-keys/:identifier/view')]),
    ];
    const paths = flattenRouteEntries(routes).map((route) => route.path);

    expect(new Set(paths).size).toBe(paths.length);
  });
});
