import type { RouteEntry } from './route-entry.interface.js';

/** Props of {@link AppRouter}. */
export interface AppRouterProps {
  /**
   * The public routes, rendered outside the authenticated layout.
   */
  readonly publicRoutes: readonly RouteEntry[];

  /**
   * The protected routes, rendered inside the authenticated layout and linked
   * in the navigation.
   */
  readonly protectedRoutes: readonly RouteEntry[];

  /**
   * The catch-all entry rendered for an unknown URL.
   */
  readonly notFoundRoute: RouteEntry;
}
