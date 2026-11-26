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
import {
  createServerError,
  createStatusError,
  createValidationError,
} from '../../test/mocks/api-error.mock.js';
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

  it('toasts a banner-classified failure and still logs it once', async () => {
    const harness = createNotificationHarness();
    const client = createAppQueryClient(harness.store);
    const error = createStatusError(401);

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

    // AIS-136 `D1`: the banner expresses the condition, the toast the moment.
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(toErrorMessage(error));
    });

    const state = harness.store.getSnapshot();

    expect(state.entries).toHaveLength(1);
    expect(state.toasts).toHaveLength(1);
  });

  it('logs a field-classified failure without a toast', async () => {
    const harness = createNotificationHarness();
    const client = createAppQueryClient(harness.store);

    render(
      <harness.Wrapper>
        <NotificationHost />
      </harness.Wrapper>,
    );

    const query = client.getQueryCache().build(client, {
      queryKey: ['api-keys', 'list'],
      queryFn: () => Promise.reject(createValidationError()),
      retry: false,
    });

    await query.fetch().catch(() => undefined);

    const state = harness.store.getSnapshot();

    expect(state.entries).toHaveLength(1);
    expect(state.toasts).toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
