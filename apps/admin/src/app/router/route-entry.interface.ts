import type { ReactElement } from 'react';

/**
 * One entry of the route registry.
 *
 * The registry is the single place where a route exists (plan `D1` of
 * AIS-118). Both the `<Routes>` markup and the navigation are derived from it,
 * so adding a page means adding one entry — never editing a second list.
 *
 * The entry carries **no logic**: it is data that the router and the nav
 * consume. The element is a `ReactElement` (already instantiated), because the
 * router renders it directly and the nav only reads the metadata.
 */
export interface RouteEntry {
  /** URL path, relative to the protected layout. Always starts with `/`. */
  readonly path: string;

  /**
   * Label shown in the navigation, or `null` when the route must not appear in
   * the nav (a detail page, a redirect, a not-found fallback).
   */
  readonly navLabel: string | null;

  /** The page component, already instantiated. */
  readonly element: ReactElement;

  /**
   * `true` for routes rendered inside the authenticated layout, `false` for the
   * public ones (the login page).
   */
  readonly protected: boolean;

  /**
   * `true` when the route exists but stays out of the nav. A route with
   * `navLabel: null` is already hidden; this flag marks a route that *has* a
   * label but is still not linked (used by the index route).
   */
  readonly hidden?: boolean;
}
