import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import type { NotificationStore } from '@callback/notifications';
import {
  APP_QUERY_RETRY_ATTEMPTS,
  APP_REFETCH_ON_WINDOW_FOCUS,
} from './app-query-client.const.js';
import {
  createMutationCacheHandlers,
  createQueryCacheHandlers,
} from './notification-capture.js';

/**
 * Builds the one query client of the admin application, with the notification
 * capture already attached (AIS-84).
 *
 * The client used to be created inline in `main.tsx`; it moved here because the
 * `QueryCache` / `MutationCache` callbacks have to be supplied **at construction
 * time** and they need the notification store. `main.tsx` still owns the
 * lifetime: it creates one client per boot and hands it to `<App>` as a prop.
 *
 * Defaults are unchanged (`retry: 1`, no refetch on focus) — this change adds
 * telemetry, it does not alter fetching behaviour.
 *
 * @param store - the application's single notification store.
 * @returns a client whose failures and announced writes are captured.
 */
export function createAppQueryClient(store: NotificationStore): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache(createQueryCacheHandlers(store)),
    mutationCache: new MutationCache(createMutationCacheHandlers(store)),
    defaultOptions: {
      queries: {
        retry: APP_QUERY_RETRY_ATTEMPTS,
        refetchOnWindowFocus: APP_REFETCH_ON_WINDOW_FOCUS,
      },
    },
  });
}
