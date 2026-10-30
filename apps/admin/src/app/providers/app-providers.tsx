import { QueryClientProvider } from '@tanstack/react-query';
import type { AppProvidersProps } from './app-providers.interface.js';
import { SessionProvider } from './session-provider.js';

/**
 * The provider chain of the admin application.
 *
 * The order is not arbitrary:
 *
 * 1. `QueryClientProvider` — the server-state bucket. It must be the outermost
 *    provider, because the notification store (AIS-84) binds its cache
 *    callbacks to this very client instance.
 * 2. `SessionProvider` — the session context the router and the layout read.
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
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
