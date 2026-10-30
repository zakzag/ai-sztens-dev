import type { RouteEntry } from '../router/route-entry.interface.js';

/** Props of {@link AdminNav}. */
export interface AdminNavProps {
  /**
   * The routes to link. Injected rather than imported, so the nav can be
   * tested with a minimal registry and cannot drift from the router.
   */
  readonly routes: readonly RouteEntry[];
}
