import type { RouteEntry } from './route-entry.interface.js';

/**
 * Flattens the route tree into the single list the flat consumers expect
 * (AIS-155 `D3`).
 *
 * Two consumers predate nested routes and work on a **flat table**: the
 * breadcrumb matcher (`matchRoute` walks a list of `path` templates) and the
 * registry invariants in `route-registry.test.ts`. Rather than teaching each of
 * them about `children`, the tree is flattened once — depth first, parent
 * before its children, i.e. in registry order.
 *
 * The function is pure and total: it never mutates its input, and an entry
 * without children (the common case) is simply returned in place.
 *
 * @param routes - the route registry, possibly nested.
 * @returns every entry of the tree, parents before their children.
 */
export function flattenRouteEntries(
  routes: readonly RouteEntry[],
): readonly RouteEntry[] {
  const flat: RouteEntry[] = [];

  for (const route of routes) {
    flat.push(route);

    if (route.children !== undefined) {
      flat.push(...flattenRouteEntries(route.children));
    }
  }

  return flat;
}
