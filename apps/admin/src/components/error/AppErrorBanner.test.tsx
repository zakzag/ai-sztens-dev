/**
 * Tests of the app-level banner.
 *
 * Every case is expressed through the two real inputs of the component — the
 * browser's connectivity and the query cache — so no internal state is poked at:
 * the banner is expected to appear, change and disappear on its own.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNetworkError, createServerError, createStatusError } from '../../test/mocks/api-error.mock.js';
import {
  emitConnectivityEvent,
  mockOnlineStatus,
  restoreOnlineStatus,
} from '../../test/mocks/online-status.mock.js';
import {
  createTestQueryClient,
  TestQueryProvider,
} from '../../test/mocks/query-client.mock.js';
import { clearQueryErrors, seedQueryError } from '../../test/mocks/query-error.mock.js';
import {
  BANNER_DISMISS_LABEL,
  NETWORK_OFFLINE_BANNER_MESSAGE,
  NETWORK_OFFLINE_BANNER_TITLE,
  SESSION_EXPIRED_BANNER_ACTION_LABEL,
  SESSION_EXPIRED_BANNER_TITLE,
  SERVICE_UNAVAILABLE_BANNER_TITLE,
} from '../../lib/error-surface.const.js';
import { AppErrorBanner } from './AppErrorBanner.js';

afterEach(() => {
  restoreOnlineStatus();
});

describe('AppErrorBanner', () => {
  it('renders nothing while online and without a banner-classified error', () => {
    const client = createTestQueryClient();

    render(
      <TestQueryProvider client={client}>
        <AppErrorBanner onLogin={vi.fn()} />
      </TestQueryProvider>,
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the offline banner while the browser reports no connection and hides it again when online', async () => {
    mockOnlineStatus(false);
    const client = createTestQueryClient();

    render(
      <TestQueryProvider client={client}>
        <AppErrorBanner onLogin={vi.fn()} />
      </TestQueryProvider>,
    );

    expect(screen.getByText(NETWORK_OFFLINE_BANNER_TITLE)).toBeInTheDocument();
    expect(screen.getByText(NETWORK_OFFLINE_BANNER_MESSAGE)).toBeInTheDocument();

    act(() => {
      mockOnlineStatus(true);
      emitConnectivityEvent('online');
    });

    expect(screen.queryByText(NETWORK_OFFLINE_BANNER_TITLE)).not.toBeInTheDocument();
  });

  it('shows the session banner with a login CTA for a cached 401', () => {
    const onLogin = vi.fn();
    const client = createTestQueryClient();

    seedQueryError(
      client,
      createStatusError(401, 'UNAUTHENTICATED'),
    );

    render(
      <TestQueryProvider client={client}>
        <AppErrorBanner onLogin={onLogin} />
      </TestQueryProvider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(SESSION_EXPIRED_BANNER_TITLE);

    // `fireEvent` on purpose: what this case asserts is the *wiring* of the CTA
    // (the only user-triggered transition of the banner), and jsdom's pointer
    // simulation of `userEvent` does not deliver to this element.
    fireEvent.click(
      screen.getByRole('button', { name: SESSION_EXPIRED_BANNER_ACTION_LABEL }),
    );

    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('shows the outage banner for a cached 503 without a CTA', () => {
    const client = createTestQueryClient();

    seedQueryError(client, createServerError(503));

    render(
      <TestQueryProvider client={client}>
        <AppErrorBanner onLogin={vi.fn()} />
      </TestQueryProvider>,
    );

    expect(screen.getByText(SERVICE_UNAVAILABLE_BANNER_TITLE)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: SESSION_EXPIRED_BANNER_ACTION_LABEL }),
    ).not.toBeInTheDocument();
  });

  it('treats a request without a response as offline even when the browser claims to be online', () => {
    const client = createTestQueryClient();

    seedQueryError(client, createNetworkError());

    render(
      <TestQueryProvider client={client}>
        <AppErrorBanner onLogin={vi.fn()} />
      </TestQueryProvider>,
    );

    expect(screen.getByText(NETWORK_OFFLINE_BANNER_TITLE)).toBeInTheDocument();
  });

  it('ignores a cached 500 — that failure belongs to the page tier', () => {
    const client = createTestQueryClient();

    seedQueryError(client, createServerError());

    render(
      <TestQueryProvider client={client}>
        <AppErrorBanner onLogin={vi.fn()} />
      </TestQueryProvider>,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('hides the current condition when the user dismisses it', async () => {
    const client = createTestQueryClient();

    seedQueryError(client, createStatusError(401, 'UNAUTHENTICATED'));

    render(
      <TestQueryProvider client={client}>
        <AppErrorBanner onLogin={vi.fn()} />
      </TestQueryProvider>,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: BANNER_DISMISS_LABEL }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a condition again after it disappeared and came back', async () => {
    const client = createTestQueryClient();

    seedQueryError(client, createStatusError(401, 'UNAUTHENTICATED'));

    render(
      <TestQueryProvider client={client}>
        <AppErrorBanner onLogin={vi.fn()} />
      </TestQueryProvider>,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: BANNER_DISMISS_LABEL }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      clearQueryErrors(client);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      seedQueryError(client, createStatusError(401, 'UNAUTHENTICATED'), 'second');
    });

    expect(screen.getByRole('alert')).toHaveTextContent(SESSION_EXPIRED_BANNER_TITLE);
  });
});
