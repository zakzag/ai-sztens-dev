import type { AppProps } from './app/app.interface.js';
import { AppErrorBoundary } from './app/error/AppErrorBoundary.js';
import { createRuntimeErrorEmitter } from './app/notifications/runtime-error.js';
import { notificationStore } from './app/notifications/notification.store.js';
import { AppProviders } from './app/providers/app-providers.js';
import { AppRouter } from './app/router/AppRouter.js';
import {
  NOT_FOUND_ROUTE_ENTRY,
  PROTECTED_ROUTE_ENTRIES,
  PUBLIC_ROUTE_ENTRIES,
} from './app/router/route-registry.js';

/**
 * The render-crash channel of the single notification store (AIS-136).
 *
 * Built at module scope on purpose: the boundary must receive a **stable**
 * handler (a new one on every render would be pointless churn), and the
 * `import.meta.env.DEV` decision about recording stack traces belongs to the
 * build, not to a render. The store itself is created outside React
 * (`app/notifications/notification.store.ts`), so importing it here cannot
 * produce a second instance.
 */
const emitRenderError = createRuntimeErrorEmitter(
  notificationStore,
  import.meta.env.DEV,
);

/**
 * The root of the admin application.
 *
 * It is composition only: the providers, the router and the error boundary
 * live in the `app/` layer, and this file wires them together. There is no
 * route markup and no navigation list here — both are derived from the route
 * registry (`app/router/route-registry.tsx`), so a new page is a single
 * registry entry (AIS-118, `D1`).
 *
 * The boundary also gets the notification port: a render crash has to reach the
 * log and a toast, and no query/mutation callback would ever see it (AIS-136).
 *
 * @param props - see {@link AppProps}.
 * @returns the application tree.
 */
export function App({ queryClient }: AppProps) {
  return (
    <AppProviders queryClient={queryClient}>
      <AppErrorBoundary onError={emitRenderError}>
        <AppRouter
          publicRoutes={PUBLIC_ROUTE_ENTRIES}
          protectedRoutes={PROTECTED_ROUTE_ENTRIES}
          notFoundRoute={NOT_FOUND_ROUTE_ENTRY}
        />
      </AppErrorBoundary>
    </AppProviders>
  );
}
