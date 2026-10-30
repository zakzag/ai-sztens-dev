/**
 * Tests of the app-level banner hook.
 *
 * The hook is the only place where “which condition wins” is wired to React, so
 * the cases here are the *wiring* ones: offline from the browser, a condition
 * from the query cache, dismissal, and the reappearance after a condition ends.
 * The classification itself is covered by `lib/error-surface.logic.test.ts`.
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createServerError,
  createStatusError,
} from '../../test/mocks/api-error.mock.js';
import {
  emitConnectivityEvent,
  mockOnlineStatus,
  restoreOnlineStatus,
} from '../../test/mocks/online-status.mock.js';
import {
  createTestQueryClient,
  TestQueryProvider,
} from '../../test/mocks/query-client.mock.js';
import {
  clearQueryErrors,
  seedQueryError,
} from '../../test/mocks/query-error.mock.js';
import { useAppErrorBanner } from './use-app-error-banner.js';

/**
 * @param client - the query client of the test.
 * @returns a `renderHook` wrapper that provides the query context.
 */
function createWrapper(client: QueryClient) {
  return function Wrapper({
    children,
  }: {
    readonly children: React.ReactNode;
  }) {
    return <TestQueryProvider client={client}>{children}</TestQueryProvider>;
  };
}

afterEach(() => {
  restoreOnlineStatus();
});

describe('useAppErrorBanner', () => {
  it('reports the offline condition while the browser says it is offline', () => {
    mockOnlineStatus(false);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useAppErrorBanner(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.model?.condition).toBe('offline');
  });

  it('drops the banner on the online event', () => {
    mockOnlineStatus(false);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useAppErrorBanner(), {
      wrapper: createWrapper(client),
    });

    act(() => {
      mockOnlineStatus(true);
      emitConnectivityEvent('online');
    });

    expect(result.current.model).toBeNull();
  });

  it('reports the outage condition for a cached 503', () => {
    const client = createTestQueryClient();
    seedQueryError(client, createServerError(503));

    const { result } = renderHook(() => useAppErrorBanner(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.model?.condition).toBe('unavailable');
  });

  it('reports nothing for a cached 500, which the page owns', () => {
    const client = createTestQueryClient();
    seedQueryError(client, createServerError());

    const { result } = renderHook(() => useAppErrorBanner(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.model).toBeNull();
  });

  it('hides the current condition when dismissed', () => {
    const client = createTestQueryClient();
    seedQueryError(client, createStatusError(401, 'UNAUTHENTICATED'));

    const { result } = renderHook(() => useAppErrorBanner(), {
      wrapper: createWrapper(client),
    });

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.model).toBeNull();
  });

  it('shows the same condition again once it disappeared and came back', () => {
    const client = createTestQueryClient();
    seedQueryError(client, createStatusError(401, 'UNAUTHENTICATED'));

    const { result } = renderHook(() => useAppErrorBanner(), {
      wrapper: createWrapper(client),
    });

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.model).toBeNull();

    act(() => {
      clearQueryErrors(client);
    });
    expect(result.current.model).toBeNull();

    act(() => {
      seedQueryError(
        client,
        createStatusError(401, 'UNAUTHENTICATED'),
        'second',
      );
    });

    expect(result.current.model?.condition).toBe('session-expired');
  });
});
