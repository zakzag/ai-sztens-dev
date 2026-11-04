/**
 * One render call with the full provider chain of the admin app.
 *
 * Mirrors [`app/providers/app-providers.tsx`](../../app/providers/app-providers.tsx)
 * but swaps the production entry points for their test counterparts:
 * an isolated query client (no retries, no cache between tests), a fresh
 * notification provider with a memory-only mirror, and a `MemoryRouter` so
 * components that read the URL state render without a browser.
 *
 * The notification provider is the one AIS-84 mounted for real, so a component
 * test inherits it without a per-test wrapper — the same order as production.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderResult } from '@testing-library/react';
import { SessionProvider } from '../../app/providers/session-provider.js';
import { createNotificationHarness } from './notification-provider.mock.js';
import { createTestQueryClient } from './query-client.mock.js';

/** Options of {@link renderWithProviders}. */
export interface RenderWithProvidersOptions {
  /** Initial history entries; defaults to `['/']`. */
  readonly initialEntries?: readonly string[];
}

/** Result of {@link renderWithProviders}: the render result plus the client. */
export interface RenderWithProvidersResult extends RenderResult {
  /** The isolated query client the tree is wrapped in. */
  readonly client: ReturnType<typeof createTestQueryClient>;
}

/**
 * Renders `ui` inside the query + session + router providers.
 *
 * @param ui - the component under test.
 * @param options - optional initial router entries.
 * @returns the testing-library result plus the query client.
 */
export function renderWithProviders(
  ui: ReactNode,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const client = createTestQueryClient();
  const NotificationWrapper = createNotificationHarness().Wrapper;

  // `initialEntries` is a mutable `InitialEntry[]` on the react-router side, so
  // a `readonly string[]` has to be copied instead of passed through (AIS-122:
  // `tsc --noEmit` failed with TS4104 here, which made `pnpm -r build` red).
  const initialEntries = [...(options.initialEntries ?? ['/'])];

  const utils = render(
    <QueryClientProvider client={client}>
      <NotificationWrapper>
        <SessionProvider>
          <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
        </SessionProvider>
      </NotificationWrapper>
    </QueryClientProvider>,
  );

  return { ...utils, client };
}
