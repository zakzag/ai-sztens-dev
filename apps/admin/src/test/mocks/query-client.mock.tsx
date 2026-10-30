/**
 * Query-client harness for hook tests.
 *
 * A dedicated client per test keeps the cache isolated (no cross-test leakage)
 * and disables retries: a retrying query would make the “error state” test sit
 * on a timer for seconds and would hit the service double more than once.
 */

import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';

/** Client defaults the tests rely on: no retries, no cached data between tests. */
export const TEST_QUERY_CLIENT_CONFIG: QueryClientConfig = {
  defaultOptions: {
    queries: { retry: false, gcTime: 0, staleTime: 0 },
    mutations: { retry: false },
  },
};

/** @returns an isolated client with the testing defaults applied. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient(TEST_QUERY_CLIENT_CONFIG);
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
