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
 *
 * Since AIS-85 `<NotificationHost />` is mounted too (exactly where
 * `AdminLayout` mounts it), and the harness is returned: a test can therefore
 * assert both the **rendered** toast and the **stored** log entry of one submit,
 * which is the acceptance criterion of the notification story.
 */

import { NotificationHost } from '@callback/notifications/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderResult } from '@testing-library/react';
import { SessionProvider } from '../../app/providers/session-provider.js';
import {
  createNotificationHarness,
  type NotificationHarness,
} from './notification-provider.mock.js';
import { createTestQueryClient } from './query-client.mock.js';

/** Options of {@link renderWithProviders}. */
export interface RenderWithProvidersOptions {
  /** Initial history entries; defaults to `['/']`. */
  readonly initialEntries?: readonly string[];
}

/** Result of {@link renderWithProviders}: the render result, client and store. */
export interface RenderWithProvidersResult extends RenderResult {
  /** The isolated query client the tree is wrapped in. */
  readonly client: ReturnType<typeof createTestQueryClient>;
  /** Store, mirror and wrapper of the notification provider in this tree. */
  readonly notifications: NotificationHarness;
}

/**
 * Renders `ui` inside the query + notification + session + router providers.
 *
 * @param ui - the component under test.
 * @param options - optional initial router entries.
 * @returns the testing-library result plus the query client and notification harness.
 */
export function renderWithProviders(
  ui: ReactNode,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const notifications = createNotificationHarness();
  const NotificationWrapper = notifications.Wrapper;
  // The capture adapters are bound to this tree's store, so a failed or
  // successful write reaches the very store the rendered host reads from.
  const client = createTestQueryClient(notifications.store);

  // `initialEntries` is a mutable `InitialEntry[]` on the react-router side, so
  // a `readonly string[]` has to be copied instead of passed through (AIS-122:
  // `tsc --noEmit` failed with TS4104 here, which made `pnpm -r build` red).
  const initialEntries = [...(options.initialEntries ?? ['/'])];

  const utils = render(
    <QueryClientProvider client={client}>
      <NotificationWrapper>
        <SessionProvider>
          <MemoryRouter initialEntries={initialEntries}>
            {ui}
            <NotificationHost />
          </MemoryRouter>
        </SessionProvider>
      </NotificationWrapper>
    </QueryClientProvider>,
  );

  return { ...utils, client, notifications };
}
