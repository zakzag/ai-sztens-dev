/**
 * Tests of the `api-keys` hooks.
 *
 * The mock point is the **network**, not the service (decision `D1` of the MSW
 * harness): the hooks run the real `apiKeysService` + `httpClient`, so the
 * envelope unwrap and the `ApiError` creation are exercised too, and only the
 * wire is replaced by the handlers in `test/mocks/handlers`.
 *
 * Since AIS-114 the state wiring lives in the generic hooks, so this suite also
 * guards the migration: the public result shape (`apiKeys`, `createApiKey`,
 * `error` as copy) is unchanged, and the pager block is now exposed as `meta`.
 *
 * Covered branches: loading, success (two rows + `meta.pagination`), success
 * (empty), second page, query error (500), query error (offline), refetch after
 * a failure, mutation success (invalidation + `onCreated`), mutation conflict
 * (field mapping), mutation transport failure, and `reset`.
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ApiKeyListQuery,
  CreateApiKeyInput,
  UpdateApiKeyInput,
} from '@callback/shared';
import { VALID_API_KEY, VALID_API_KEY_PAIR } from '@callback/shared';
import {
  apiKeysCreateConflict,
  apiKeysCreateNetworkError,
  apiKeysDeleteNotFound,
  apiKeysDetailNotFound,
  apiKeysListEmpty,
  apiKeysListNetworkError,
  apiKeysListPageTwo,
  apiKeysListServerError,
  apiKeysUpdateStaleWrite,
} from '../../test/mocks/handlers/api-keys.handlers.js';
import { server } from '../../test/mocks/server.js';
import {
  createTestQueryClient,
  TestQueryProvider,
} from '../../test/mocks/query-client.mock.js';
import {
  IDENTIFIER_CONFLICT_MESSAGE,
  NETWORK_ERROR_USER_MESSAGE,
  NOT_FOUND_MESSAGE,
  SERVER_ERROR_MESSAGE,
  STALE_WRITE_MESSAGE,
} from '../../lib/error-message.const.js';
import {
  API_KEYS_QUERY_KEYS,
  API_KEY_FIELD_PATHS,
  API_KEY_IDENTIFIER_CONFLICT_MESSAGE,
  DEFAULT_FIELD_PATH_BY_CODE,
} from './api-keys.const.js';
import { toFieldErrors } from '../../lib/field-errors.logic.js';
import {
  useApiKeyDetailQuery,
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useDeleteApiKeyMutation,
  useUpdateApiKeyMutation,
} from './use-api-keys.js';

/** Minimal valid create payload every mutation test submits. */
const CREATE_INPUT: CreateApiKeyInput = {
  name: 'Vapi staging',
  identifier: 'vapi-staging',
  apiKey: 'sk-stage-42',
};

/** Minimal valid `PATCH` body: one changed field plus the version token. */
const UPDATE_INPUT: UpdateApiKeyInput = {
  name: 'Vapi prod renamed',
  updatedAt: VALID_API_KEY.updatedAt,
};

/** The list query every read test starts from (the contract defaults). */
const LIST_PARAMS: ApiKeyListQuery = {
  page: 1,
  limit: 20,
  sort: 'createdAt',
  order: 'desc',
};

/** The field target the create form passes to the shared mapper. */
const API_KEY_FORM_TARGET = {
  fieldPaths: API_KEY_FIELD_PATHS,
  defaultPathByCode: DEFAULT_FIELD_PATH_BY_CODE,
} as const;

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

describe('useApiKeysQuery', () => {
  let client: QueryClient;

  beforeEach(() => {
    server.resetHandlers();
    client = createTestQueryClient();
  });

  it('reports loading before the first response', () => {
    const { result } = renderHook(() => useApiKeysQuery(LIST_PARAMS), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);
    expect(result.current.apiKeys).toEqual([]);
    expect(result.current.meta).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.errorSurface).toBeNull();
  });

  it('exposes the keys and meta.pagination after a successful read', async () => {
    const { result } = renderHook(() => useApiKeysQuery(LIST_PARAMS), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.apiKeys).toEqual(VALID_API_KEY_PAIR);
    expect(result.current.meta?.pagination).toEqual({
      page: 1,
      limit: 20,
      total: VALID_API_KEY_PAIR.length,
      totalPages: 1,
    });
    expect(result.current.meta?.requestId).toBeTruthy();
    expect(result.current.isFetching).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.errorSurface).toBeNull();
  });

  it('exposes an empty list for an empty payload', async () => {
    server.use(apiKeysListEmpty);

    const { result } = renderHook(() => useApiKeysQuery(LIST_PARAMS), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.apiKeys).toEqual([]);
    expect(result.current.meta?.pagination.total).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('keeps the requested page in meta.pagination', async () => {
    server.use(apiKeysListPageTwo);

    const pageTwo: ApiKeyListQuery = { ...LIST_PARAMS, page: 2, limit: 1 };

    const { result } = renderHook(() => useApiKeysQuery(pageTwo), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.apiKeys).toHaveLength(1);
    expect(result.current.meta?.pagination).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it('routes a request without a response to the banner and keeps the raw error', async () => {
    server.use(apiKeysListNetworkError);

    const { result } = renderHook(() => useApiKeysQuery(LIST_PARAMS), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('banner');
    });

    expect(result.current.errorMessage).toBe(NETWORK_ERROR_USER_MESSAGE);
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.status).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.apiKeys).toEqual([]);
    expect(result.current.meta).toBeNull();
  });

  it('routes a 500 to the page tier and keeps the requestId for the log tier', async () => {
    server.use(apiKeysListServerError);

    const { result } = renderHook(() => useApiKeysQuery(LIST_PARAMS), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    expect(result.current.errorMessage).toBe(SERVER_ERROR_MESSAGE);
    expect(result.current.error?.requestId).toBe('req-server');
  });

  it('re-reads the list on refetch, including after a failure', async () => {
    server.use(apiKeysListServerError);

    const { result } = renderHook(() => useApiKeysQuery(LIST_PARAMS), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.errorSurface).toBe('page');
    });

    // The user-triggered retry: restore the default success handler, then ask
    // the hook to re-read the list (automatic retry stays disabled by config).
    server.resetHandlers();

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });

    expect(result.current.errorSurface).toBeNull();
    expect(result.current.apiKeys).toEqual(VALID_API_KEY_PAIR);
  });
});

describe('useCreateApiKeyMutation', () => {
  let client: QueryClient;

  beforeEach(() => {
    server.resetHandlers();
    client = createTestQueryClient();
  });

  it('creates the key, invalidates the list and calls onCreated', async () => {
    const onCreated = vi.fn();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(
      () => useCreateApiKeyMutation({ onCreated }),
      { wrapper: createWrapper(client) },
    );

    await act(async () => {
      await result.current.createApiKey(CREATE_INPUT);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: API_KEYS_QUERY_KEYS.all,
    });
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          name: CREATE_INPUT.name,
          identifier: CREATE_INPUT.identifier,
          apiKey: CREATE_INPUT.apiKey,
        }),
      );
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('rejects a duplicate identifier and maps it onto the field', async () => {
    server.use(apiKeysCreateConflict);

    const { result } = renderHook(() => useCreateApiKeyMutation(), {
      wrapper: createWrapper(client),
    });

    let caught: unknown = null;

    await act(async () => {
      try {
        await result.current.createApiKey(CREATE_INPUT);
      } catch (error) {
        caught = error;
      }
    });

    expect(toFieldErrors(caught, API_KEY_FORM_TARGET)).toEqual({
      fields: { identifier: API_KEY_IDENTIFIER_CONFLICT_MESSAGE },
      form: null,
    });
    await waitFor(() => {
      // Code-first copy: the 409 carries `API_KEY_IDENTIFIER_CONFLICT`, so the
      // page-level message is the domain sentence, never the server's English one.
      expect(result.current.error).toBe(IDENTIFIER_CONFLICT_MESSAGE);
    });
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it('rejects with the original error and reports a transport failure', async () => {
    server.use(apiKeysCreateNetworkError);

    const { result } = renderHook(() => useCreateApiKeyMutation(), {
      wrapper: createWrapper(client),
    });

    let caught: unknown = null;

    await act(async () => {
      try {
        await result.current.createApiKey(CREATE_INPUT);
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect(toFieldErrors(caught, API_KEY_FORM_TARGET)).toEqual({
      fields: {},
      form: NETWORK_ERROR_USER_MESSAGE,
    });
    await waitFor(() => {
      expect(result.current.error).toBe(NETWORK_ERROR_USER_MESSAGE);
    });
  });

  it('clears error and success state on reset', async () => {
    server.use(apiKeysCreateConflict);

    const { result } = renderHook(() => useCreateApiKeyMutation(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      try {
        await result.current.createApiKey(CREATE_INPUT);
      } catch {
        // Intentional: the failure is asserted through `result.current.error`.
      }
    });

    await waitFor(() => {
      expect(result.current.error).toBe(IDENTIFIER_CONFLICT_MESSAGE);
    });

    act(() => {
        result.current.reset();
      });
  
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
      expect(result.current.isSuccess).toBe(false);
    });
  });
  
  describe('useApiKeyDetailQuery', () => {
    let client: QueryClient;
  
    beforeEach(() => {
      server.resetHandlers();
      client = createTestQueryClient();
    });
  
    it('returns the resource of the identifier', async () => {
      const { result } = renderHook(
        () => useApiKeyDetailQuery(VALID_API_KEY.identifier),
        { wrapper: createWrapper(client) },
      );
  
      expect(result.current.data).toBeNull();
  
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
  
      expect(result.current.data).toEqual(VALID_API_KEY);
      expect(result.current.error).toBeNull();
    });
  
    it('reports a 404 as a page-tier failure instead of empty data', async () => {
      server.use(apiKeysDetailNotFound);
  
      const { result } = renderHook(
        () => useApiKeyDetailQuery('ghost'),
        { wrapper: createWrapper(client) },
      );
  
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
  
      expect(result.current.data).toBeNull();
      expect(result.current.errorMessage).toBe(NOT_FOUND_MESSAGE);
      expect(result.current.errorSurface).toBe('page');
    });
  
    it('does not request anything while disabled', () => {
      const { result } = renderHook(() => useApiKeyDetailQuery('', false), {
        wrapper: createWrapper(client),
      });
  
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull();
    });
  });
  
  describe('useUpdateApiKeyMutation', () => {
    let client: QueryClient;
  
    beforeEach(() => {
      server.resetHandlers();
      client = createTestQueryClient();
    });
  
    it('patches the key and reports success', async () => {
      const onUpdated = vi.fn();
      const { result } = renderHook(
        () =>
          useUpdateApiKeyMutation(VALID_API_KEY.identifier, { onUpdated }),
        { wrapper: createWrapper(client) },
      );
  
      await act(async () => {
        await result.current.updateApiKey(UPDATE_INPUT);
      });
  
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(onUpdated).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeNull();
    });
  
    it('keeps the raw error of a stale write on the page tier', async () => {
      server.use(apiKeysUpdateStaleWrite);
  
      const { result } = renderHook(
        () => useUpdateApiKeyMutation(VALID_API_KEY.identifier),
        { wrapper: createWrapper(client) },
      );
  
      await act(async () => {
        try {
          await result.current.updateApiKey(UPDATE_INPUT);
        } catch {
          // Intentional: the failure is asserted through `result.current`.
        }
      });
  
      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });
      expect(result.current.errorMessage).toBe(STALE_WRITE_MESSAGE);
      expect(result.current.errorSurface).toBe('page');
    });
  });
  
  describe('useDeleteApiKeyMutation', () => {
    let client: QueryClient;
  
    beforeEach(() => {
      server.resetHandlers();
      client = createTestQueryClient();
    });
  
    it('deletes the key and calls onDeleted', async () => {
      const onDeleted = vi.fn();
      const { result } = renderHook(
        () =>
          useDeleteApiKeyMutation(VALID_API_KEY.identifier, { onDeleted }),
        { wrapper: createWrapper(client) },
      );
  
      await act(async () => {
        await result.current.deleteApiKey();
      });
  
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(onDeleted).toHaveBeenCalledTimes(1);
    });
  
    it('reports a failed delete without calling onDeleted', async () => {
      server.use(apiKeysDeleteNotFound);
      const onDeleted = vi.fn();
  
      const { result } = renderHook(
        () => useDeleteApiKeyMutation(VALID_API_KEY.identifier, { onDeleted }),
        { wrapper: createWrapper(client) },
      );
  
      await act(async () => {
        try {
          await result.current.deleteApiKey();
        } catch {
          // Intentional: the failure is asserted through `result.current`.
        }
      });
  
      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });
      expect(result.current.errorMessage).toBe(NOT_FOUND_MESSAGE);
      expect(result.current.errorSurface).toBe('page');
      expect(onDeleted).not.toHaveBeenCalled();
    });
  });
