/**
 * Tests of {@link useApiList}.
 *
 * The mock point is the network (MSW), not the service: the hook runs the real
 * `apiKeysService` + transport, so the paginated unwrap — including the required
 * `meta.pagination` — is exercised as well. The list is used as the concrete
 * resource because it is the only paginated endpoint in the app; the hook itself
 * knows nothing about api-keys.
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiKey, ApiKeyListQuery } from '@callback/shared';
import { VALID_API_KEY_PAIR } from '@callback/shared';
import {
  NETWORK_ERROR_USER_MESSAGE,
  SERVER_ERROR_MESSAGE,
} from '../../lib/error-message.const.js';
import { apiKeysService } from '../../services/api-client.js';
import {
  apiKeysListEmpty,
  apiKeysListNetworkError,
  apiKeysListServerError,
} from '../../test/mocks/handlers/api-keys.handlers.js';
import {
  createTestQueryClient,
  TestQueryProvider,
} from '../../test/mocks/query-client.mock.js';
import { server } from '../../test/mocks/server.js';
import { useApiList } from './use-api-list.js';

/** The query every test starts from (the contract defaults). */
const LIST_PARAMS: ApiKeyListQuery = {
  page: 1,
  limit: 20,
  sort: 'createdAt',
  order: 'desc',
};

/** Stable empty fallback, exactly as a use case would pass it. */
const EMPTY_ROWS: readonly ApiKey[] = Object.freeze([]);

/**
 * @param client - the query client of the test.
 * @returns the rendered list hook.
 */
function renderList(client: QueryClient) {
  return renderHook(
    () =>
      useApiList<readonly ApiKey[]>({
        queryKey: ['api-keys', 'list', LIST_PARAMS],
        queryFn: () => apiKeysService.list(LIST_PARAMS),
        emptyData: EMPTY_ROWS,
      }),
    {
      wrapper: ({ children }) => (
        <TestQueryProvider client={client}>{children}</TestQueryProvider>
      ),
    },
  );
}

describe('useApiList', () => {
  let client: QueryClient;

  beforeEach(() => {
    server.resetHandlers();
    client = createTestQueryClient();
  });

  it('reports loading with the stable empty fallback and no meta', () => {
    const { result } = renderList(client);

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);
    expect(result.current.data).toBe(EMPTY_ROWS);
    expect(result.current.meta).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.errorSurface).toBeNull();
  });

  it('exposes the rows together with meta.pagination', async () => {
    const { result } = renderList(client);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(VALID_API_KEY_PAIR);
    expect(result.current.meta?.pagination).toEqual({
      page: 1,
      limit: 20,
      total: VALID_API_KEY_PAIR.length,
      totalPages: 1,
    });
    expect(result.current.isFetching).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('exposes an empty page as empty rows with total 0', async () => {
    server.use(apiKeysListEmpty);

    const { result } = renderList(client);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.meta?.pagination.total).toBe(0);
    expect(result.current.meta?.pagination.totalPages).toBe(0);
  });

  it('routes a 500 to the page tier and keeps the raw error', async () => {
    server.use(apiKeysListServerError);

    const { result } = renderList(client);

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    expect(result.current.errorMessage).toBe(SERVER_ERROR_MESSAGE);
    expect(result.current.error?.requestId).toBe('req-server');
    expect(result.current.data).toBe(EMPTY_ROWS);
    expect(result.current.meta).toBeNull();
  });

  it('routes a request without a response to the banner tier', async () => {
    server.use(apiKeysListNetworkError);

    const { result } = renderList(client);

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('banner');
    });

    expect(result.current.errorMessage).toBe(NETWORK_ERROR_USER_MESSAGE);
    expect(result.current.error?.status).toBeNull();
  });

  it('recovers on refetch after a failure', async () => {
    server.use(apiKeysListServerError);

    const { result } = renderList(client);

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    server.resetHandlers();

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });

    expect(result.current.data).toEqual(VALID_API_KEY_PAIR);
    expect(result.current.meta?.pagination.total).toBe(
      VALID_API_KEY_PAIR.length,
    );
  });

  it('does not fetch when it is disabled', () => {
    const { result } = renderHook(
      () =>
        useApiList<readonly ApiKey[]>({
          queryKey: ['api-keys', 'list', 'disabled'],
          queryFn: () => apiKeysService.list(LIST_PARAMS),
          emptyData: EMPTY_ROWS,
          enabled: false,
        }),
      {
        wrapper: ({ children }) => (
          <TestQueryProvider client={client}>{children}</TestQueryProvider>
        ),
      },
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBe(EMPTY_ROWS);
    expect(result.current.meta).toBeNull();
  });
});
