import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../layout/AdminLayout.js';
import { ProtectedRoute } from './ProtectedRoute.js';
import type { AppRouterProps } from './app-router.interface.js';
import type { RouteEntry } from './route-entry.interface.js';

/**
 * The router of the admin application, built from the route registry.
 *
 * The structure is the same as before the `app/` layer existed — the public
 * routes first, then a catch-all that hosts the protected ones — but the route
 * list is no longer written by hand: it comes from the registry (AIS-118,
 * `D1`).
 *
 * The protected routes render inside `ProtectedRoute`, which decides between
 * the login page and the layout shell, and inside `AdminLayout`, which owns the
 * frame and the navigation.
 *
 * @param props - see {@link AppRouterProps}.
 * @returns the routed tree.
 */
export function AppRouter({
  publicRoutes,
  protectedRoutes,
  notFoundRoute,
}: AppRouterProps) {
  return (
    <Routes>
      {toRouteElements(publicRoutes)}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AdminLayout routes={protectedRoutes}>
              <ProtectedRoutes
                routes={protectedRoutes}
                notFoundRoute={notFoundRoute}
              />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

/** Props of {@link ProtectedRoutes}. */
interface ProtectedRoutesProps {
  /** The protected routes to match against the current URL. */
  readonly routes: AppRouterProps['protectedRoutes'];

  /** The catch-all entry. */
  readonly notFoundRoute: AppRouterProps['notFoundRoute'];
}

/**
 * The route table of the authenticated part of the application.
 *
 * It is a separate component because it needs its own `<Routes>`: the
 * protected paths are relative to the `/*` route, so they cannot live in the
 * same `<Routes>` element as the public ones.
 *
 * @param props - see {@link ProtectedRoutesProps}.
 * @returns the matched route, or the not-found entry.
 */
function ProtectedRoutes({ routes, notFoundRoute }: ProtectedRoutesProps) {
  return (
    <Routes>
      {toRouteElements(routes)}
      <Route path={notFoundRoute.path} element={notFoundRoute.element} />
    </Routes>
  );
}

/**
 * Turns the registry tree into `<Route>` elements (AIS-155 `D2`).
 *
 * An entry with `children` becomes a **layout** route: React Router renders its
 * `element` whenever the parent path matches and paints the matched child inside
 * that element's `<Outlet/>`. That is exactly the overlay contract — the list
 * page stays mounted while `/api-keys/new` renders the dialog above it — and it
 * needs no query parameter and no second source of "is the dialog open".
 *
 * The child paths are absolute and begin with the parent path, which React
 * Router accepts for nested routes, so the registry keeps one literal per route
 * that the address bar, the links and the breadcrumb can all reuse.
 *
 * @param routes - one level of the registry tree.
 * @returns the matching `<Route>` elements, children nested under their parent.
 */
function toRouteElements(
  routes: readonly RouteEntry[],
): readonly ReactElement[] {
  return routes.map((route) => {
    if (route.children === undefined || route.children.length === 0) {
      return (
        <Route key={route.path} path={route.path} element={route.element} />
      );
    }

    return (
      <Route key={route.path} path={route.path} element={route.element}>
        {toRouteElements(route.children)}
      </Route>
    );
  });
}
