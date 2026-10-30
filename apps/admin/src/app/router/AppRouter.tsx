import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../layout/AdminLayout.js';
import { ProtectedRoute } from './ProtectedRoute.js';
import type { AppRouterProps } from './app-router.interface.js';

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
      {publicRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
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
      {routes.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
      <Route path={notFoundRoute.path} element={notFoundRoute.element} />
    </Routes>
  );
}
