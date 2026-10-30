import type { AppProps } from './app/app.interface.js';
import { AppErrorBoundary } from './app/error/AppErrorBoundary.js';
import { AppProviders } from './app/providers/app-providers.js';
import { AppRouter } from './app/router/AppRouter.js';
import {
  NOT_FOUND_ROUTE_ENTRY,
  PROTECTED_ROUTE_ENTRIES,
  PUBLIC_ROUTE_ENTRIES,
} from './app/router/route-registry.js';

/**
 * The root of the admin application.
 *
 * It is composition only: the providers, the router and the error boundary
 * live in the `app/` layer, and this file wires them together. There is no
 * route markup and no navigation list here — both are derived from the route
 * registry (`app/router/route-registry.tsx`), so a new page is a single
 * registry entry (AIS-118, `D1`).
 *
 * @param props - see {@link AppProps}.
 * @returns the application tree.
 */
export function App({ queryClient }: AppProps) {
  return (
    <AppProviders queryClient={queryClient}>
      <AppErrorBoundary>
        <AppRouter
          publicRoutes={PUBLIC_ROUTE_ENTRIES}
          protectedRoutes={PROTECTED_ROUTE_ENTRIES}
          notFoundRoute={NOT_FOUND_ROUTE_ENTRY}
        />
      </AppErrorBoundary>
    </AppProviders>
  );
}
