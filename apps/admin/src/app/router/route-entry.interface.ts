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

  /**
   * Static text of this route's breadcrumb cell (AIS-140 `D5`, AIS-146).
   *
   * `null` means the entry contributes **no** cell of its own: either the route
   * never appears in a trail (the public login page, the `*` catch-all) or the
   * text is dynamic and comes from {@link resolveBreadcrumbLabel}. An entry is
   * part of a trail when `breadcrumbLabel !== null` **or** it carries a
   * resolver; with neither it is skipped, while its parent chain still builds.
   *
   * Required on purpose: a new route must decide about its breadcrumb instead
   * of silently shipping without one.
   */
  readonly breadcrumbLabel: string | null;

  /**
   * Registry path of the parent route (AIS-140 `D5`, AIS-146).
   *
   * The trail is built by walking this pointer upwards, so a parent is declared
   * once, next to its child, and never re-typed as a list. Omitted on the root
   * entry; a pointer that names no entry simply ends the chain — the trail
   * builder never throws.
   */
  readonly breadcrumbParentPath?: string;

  /**
   * Resolver of the crumb text of a **dynamic** route (AIS-140 `D5`, AIS-146).
   *
   * Mandatory when `path` contains `:`, because a template segment is not
   * readable (`:identifier` is no crumb text). It receives the params derived
   * from the matched URL, e.g. `(params) => params.identifier`, and its result
   * wins over {@link breadcrumbLabel}. `packages/ui` never sees this: the
   * resolution is pure data logic that belongs to the admin's `app/router`.
   */
  readonly resolveBreadcrumbLabel?: (
    params: Readonly<Record<string, string>>,
  ) => string;
}
