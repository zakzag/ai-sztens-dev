/**
 * Tests of {@link useApiDetail}.
 *
 * As with the list hook, the mock point is the network: the real service and
 * transport run, so a `404` really is an `ApiError` with a code and the hook only
 * has to project it. The api-keys detail endpoint is the concrete resource.
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiKey } from '@callback/shared';
import { VALID_API_KEY } from '@callback/shared';
import { apiKeysService } from '../../services/api-client.js';
import { apiKeysDetailNotFound } from '../../test/mocks/handlers/api-keys.handlers.js';
import {
  createTestQueryClient,
  TestQueryProvider,
} from '../../test/mocks/query-client.mock.js';
import { server } from '../../test/mocks/server.js';
import { useApiDetail } from './use-api-detail.js';

/**
 * @param client - the query client of the test.
 * @param identifier - the key to read.
 * @param enabled - whether the request may run.
 * @returns the rendered detail hook.
 */
function renderDetail(client: QueryClient, identifier: string, enabled = true) {
  return renderHook(
    () =>
      useApiDetail<ApiKey>({
        queryKey: ['api-keys', 'detail', identifier],
        queryFn: () => apiKeysService.findByIdentifier(identifier),
        enabled,
      }),
    {
      wrapper: ({ children }) => (
        <TestQueryProvider client={client}>{children}</TestQueryProvider>
      ),
    },
  );
}

describe('useApiDetail', () => {
  let client: QueryClient;

  beforeEach(() => {
    server.resetHandlers();
    client = createTestQueryClient();
  });

  it('reports loading with a null resource', () => {
    const { result } = renderDetail(client, VALID_API_KEY.identifier);

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.errorSurface).toBeNull();
  });

  it('exposes the resource after a successful read', async () => {
    const { result } = renderDetail(client, VALID_API_KEY.identifier);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(VALID_API_KEY);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('routes a 404 to the page tier and keeps the code', async () => {
    server.use(apiKeysDetailNotFound);

    const { result } = renderDetail(client, 'ghost');

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error?.status).toBe(404);
    expect(result.current.error?.code).toBe('NOT_FOUND');
  });

  it('recovers on refetch after a 404', async () => {
    server.use(apiKeysDetailNotFound);

    const { result } = renderDetail(client, VALID_API_KEY.identifier);

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    server.resetHandlers();

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });

    expect(result.current.data?.id).toBe(VALID_API_KEY.id);
  });

  it('never calls the service while it is disabled', () => {
    const queryFn = vi.fn(async () => VALID_API_KEY);

    const { result } = renderHook(
      () =>
        useApiDetail<ApiKey>({
          queryKey: ['api-keys', 'detail', 'disabled'],
          queryFn,
          enabled: false,
        }),
      {
        wrapper: ({ children }) => (
          <TestQueryProvider client={client}>{children}</TestQueryProvider>
        ),
      },
    );

    expect(queryFn).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });
});
