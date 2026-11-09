import { NotificationProvider } from '@callback/notifications/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { notificationStorage, notificationStore } from '../notifications/notification.store.js';
import { ThemeProvider } from '../theme/theme-provider.js';
import type { AppProvidersProps } from './app-providers.interface.js';
import { SessionProvider } from './session-provider.js';

/**
 * The provider chain of the admin application.
 *
 * The order is not arbitrary:
 *
 * 1. `QueryClientProvider` — the server-state bucket. It is the outermost
 *    provider because the notification store binds its cache callbacks to this
 *    very client instance (AIS-84), and those callbacks fire before any
 *    component exists.
 * 2. `NotificationProvider` — the global log/toast store. It receives the
 *    **singleton** store and its `sessionStorage` mirror, so the entries the
 *    cache callbacks and the HTTP listener wrote are exactly what the UI reads
 *    back (AIS-83 `D3`: an injected store is not seeded by the provider, hence
 *    the mirror is injected too).
 * 3. `SessionProvider` — the session context the router and the layout read.
 * 4. `ThemeProvider` — the applied appearance (AIS-165). It is innermost
 *    because nothing above it consumes the theme, and it must wrap **both** the
 *    public and the protected routes: the login page is themed too.
 *
 * The `QueryClient` itself is **created in `main.tsx`** and handed in as a prop
 * rather than instantiated here: the client is not a React concern, and keeping
 * its creation at the entry point makes the dependency explicit.
 *
 * The router (`BrowserRouter`) stays in `main.tsx` too — it is the navigation
 * context, not a provider, and the `app/` layer consumes it rather than
 * owning it.
 *
 * @param props - see {@link AppProvidersProps}.
 * @returns the children, wrapped in the provider chain.
 */
export function AppProviders({ queryClient, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider
        store={notificationStore}
        storage={notificationStorage}
        includeDetails={import.meta.env.DEV}
      >
        <SessionProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </SessionProvider>
      </NotificationProvider>
    </QueryClientProvider>
  );
}
