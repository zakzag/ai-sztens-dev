/**
 * End-to-end behaviour of the capture inside the real provider chain (AIS-84).
 *
 * This is the test the ticket asks for: a failure that nobody handles explicitly
 * still reaches the user — the toast appears and the log drawer counts it as
 * unseen — without a single `notify(...)` call in the component under test.
 */

import { NotificationHost } from '@callback/notifications/react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createServerError } from '../../test/mocks/api-error.mock.js';
import { createNotificationHarness } from '../../test/mocks/notification-provider.mock.js';
import { toErrorMessage } from '../../lib/error-message.js';
import { createAppQueryClient } from './app-query-client.js';

describe('notification capture in the provider chain', () => {
  it('shows a toast and an unseen log entry for a failed query', async () => {
    const harness = createNotificationHarness();
    const client = createAppQueryClient(harness.store);
    const error = createServerError();

    render(
      <harness.Wrapper>
        <NotificationHost />
      </harness.Wrapper>,
    );

    const query = client.getQueryCache().build(client, {
      queryKey: ['api-keys', 'list'],
      queryFn: () => Promise.reject(error),
      retry: false,
    });

    await query.fetch().catch(() => undefined);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(toErrorMessage(error));
    });

    const [entry] = harness.store.getSnapshot().entries;

    expect(entry?.level).toBe('error');
    expect(entry?.source).toBe('api');
    expect(entry?.read).toBe(false);
  });

  it('keeps a successful request out of the toasts', async () => {
    const harness = createNotificationHarness();
    const client = createAppQueryClient(harness.store);

    render(
      <harness.Wrapper>
        <NotificationHost />
      </harness.Wrapper>,
    );

    const query = client.getQueryCache().build(client, {
      queryKey: ['api-keys', 'list'],
      queryFn: () => Promise.resolve([]),
      retry: false,
    });

    await query.fetch();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
