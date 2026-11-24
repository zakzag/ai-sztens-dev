/**
 * `renderHook` with a query client (AIS-19).
 *
 * `renderHookWithRouter` supplies the router and the shell providers but **not**
 * a `QueryClient` — the app-level one is created in `main.tsx`. A hook that reads
 * server state therefore needs its own harness; this is the single place that
 * wrapper exists, so no test file has to declare one.
 */

import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createTestQueryClient } from './query-client.mock.js';

/** Result of {@link renderHookWithQueryClient}. */
export interface RenderHookWithQueryClientResult<TResult> {
  /** The standard `renderHook` result. */
  readonly result: { current: TResult };
  /** The isolated client the hook ran against. */
  readonly client: QueryClient;
}

/**
 * @param hook - the hook under test.
 * @returns the render result plus the client.
 */
export function renderHookWithQueryClient<TResult>(
  hook: () => TResult,
): RenderHookWithQueryClientResult<TResult> {
  const client = createTestQueryClient();

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  const { result } = renderHook(hook, { wrapper: Wrapper });

  return { result, client };
}
