/**
 * Query-client harness for hook tests.
 *
 * A dedicated client per test keeps the cache isolated (no cross-test leakage)
 * and disables retries: a retrying query would make the “error state” test sit
 * on a timer for seconds and would hit the service double more than once.
 *
 * Since AIS-85 the factory can bind the **real** capture adapters
 * (`app/notifications/notification-capture.ts`) to a notification store. A
 * component test that renders the whole shell can then assert the acceptance
 * criterion of the notification story — one failed/successful write produces
 * exactly one entry, and only a `page`-surface failure also becomes a toast —
 * without re-implementing the policy in the test.
 */

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from '@tanstack/react-query';
import type { NotificationStore } from '@callback/notifications';
import type { ReactNode } from 'react';
import {
  createMutationCacheHandlers,
  createQueryCacheHandlers,
} from '../../app/notifications/notification-capture.js';

/** Client defaults the tests rely on: no retries, no cached data between tests. */
export const TEST_QUERY_CLIENT_CONFIG: QueryClientConfig = {
  defaultOptions: {
    queries: { retry: false, gcTime: 0, staleTime: 0 },
    mutations: { retry: false },
  },
};

/**
 * @param store - optional notification store to bind the capture adapters to;
 *   omitted, the client stays notification-free (pure hook tests).
 * @returns an isolated client with the testing defaults applied.
 */
export function createTestQueryClient(store?: NotificationStore): QueryClient {
  if (store === undefined) {
    return new QueryClient(TEST_QUERY_CLIENT_CONFIG);
  }

  return new QueryClient({
    ...TEST_QUERY_CLIENT_CONFIG,
    queryCache: new QueryCache(createQueryCacheHandlers(store)),
    mutationCache: new MutationCache(createMutationCacheHandlers(store)),
  });
}

/** Props of {@link TestQueryProvider}. */
export interface TestQueryProviderProps {
  /** Client created by {@link createTestQueryClient}. */
  readonly client: QueryClient;
  /** Component under test. */
  readonly children: ReactNode;
}

/** `renderHook`/`render` wrapper that supplies the query context. */
export function TestQueryProvider({
  client,
  children,
}: TestQueryProviderProps) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
