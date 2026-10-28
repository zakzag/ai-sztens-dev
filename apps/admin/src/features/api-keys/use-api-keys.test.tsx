/**
 * Tests of the `api-keys` hooks.
 *
 * The service module is replaced at the module boundary, so every assertion
 * runs without a network, without timers and without a real backend. Covered
 * branches: loading, success, query error, mutation success (invalidation +
 * `onCreated`), mutation conflict (field-level mapping), mutation failure of
 * another kind, and `reset`.
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createConflictError,
  createNetworkError,
} from '../../test/mocks/api-error.mock.js';
import {
  API_KEYS_SERVICE_MOCK,
  API_KEY_FIXTURES,
  CREATE_API_KEY_INPUT_FIXTURE,
  CREATED_API_KEY_FIXTURE,
  resetApiKeysServiceMock,
} from '../../test/mocks/api-keys.mock.js';
import {
  createTestQueryClient,
  TestQueryProvider,
} from '../../test/mocks/query-client.mock.js';
import {
  IDENTIFIER_CONFLICT_MESSAGE,
  NETWORK_ERROR_USER_MESSAGE,
} from '../../lib/error-message.const.js';
import { API_KEYS_QUERY_KEYS } from './api-keys.const.js';
import { toIdentifierFieldError } from './api-keys.logic.js';
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
} from './use-api-keys.js';

/**
 * Replaces the composition root so the hooks talk to the double.
 *
 * The factory has to import the mock module dynamically: `vi.mock` calls are
 * hoisted above the static imports, so a top-level binding would be `undefined`
 * at factory time.
 */
vi.mock('../../services/api-client.js', async () => {
  const { API_KEYS_SERVICE_MOCK: serviceMock } = await import(
    '../../test/mocks/api-keys.mock.js'
  );

  return { apiKeysService: serviceMock.service };
});

/**
 * @param client - the query client of the test.
 * @returns a `renderHook` wrapper that provides the query context.
 */
function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return <TestQueryProvider client={client}>{children}</TestQueryProvider>;
  };
}

describe('useApiKeysQuery', () => {
  let client: QueryClient;

  beforeEach(() => {
    resetApiKeysServiceMock();
    client = createTestQueryClient();
  });

  it('reports loading before the first response', () => {
    const { result } = renderHook(() => useApiKeysQuery(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.apiKeys).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('exposes the keys after a successful read', async () => {
    const { result } = renderHook(() => useApiKeysQuery(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.apiKeys).toEqual(API_KEY_FIXTURES);
    expect(result.current.error).toBeNull();
    expect(API_KEYS_SERVICE_MOCK.listMock).toHaveBeenCalledTimes(1);
  });

  it('maps a failed read to a user-facing message and an empty list', async () => {
    API_KEYS_SERVICE_MOCK.listMock.mockRejectedValueOnce(createNetworkError());

    const { result } = renderHook(() => useApiKeysQuery(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.error).toBe(NETWORK_ERROR_USER_MESSAGE);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.apiKeys).toEqual([]);
  });

  it('re-reads the list on refetch, including after a failure', async () => {
    API_KEYS_SERVICE_MOCK.listMock.mockRejectedValueOnce(createNetworkError());

    const { result } = renderHook(() => useApiKeysQuery(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.error).toBe(NETWORK_ERROR_USER_MESSAGE);
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });

    expect(result.current.apiKeys).toEqual(API_KEY_FIXTURES);
    expect(API_KEYS_SERVICE_MOCK.listMock).toHaveBeenCalledTimes(2);
  });
});

describe('useCreateApiKeyMutation', () => {
  let client: QueryClient;

  beforeEach(() => {
    resetApiKeysServiceMock();
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
      await result.current.createApiKey(CREATE_API_KEY_INPUT_FIXTURE);
    });

    expect(API_KEYS_SERVICE_MOCK.createMock).toHaveBeenCalledWith(
      CREATE_API_KEY_INPUT_FIXTURE,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: API_KEYS_QUERY_KEYS.all,
    });
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(CREATED_API_KEY_FIXTURE);
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('rejects a duplicate identifier and maps it onto the field', async () => {
    API_KEYS_SERVICE_MOCK.createMock.mockRejectedValueOnce(
      createConflictError(),
    );

    const { result } = renderHook(() => useCreateApiKeyMutation(), {
      wrapper: createWrapper(client),
    });

    let caught: unknown = null;

    await act(async () => {
      try {
        await result.current.createApiKey(CREATE_API_KEY_INPUT_FIXTURE);
      } catch (error) {
        caught = error;
      }
    });

    expect(toIdentifierFieldError(caught)).toBe(
      'Ez az identifier már foglalt. Adj meg egyedit.',
    );
    await waitFor(() => {
      // Code-first copy: the 409 carries `API_KEY_IDENTIFIER_CONFLICT`, so the
      // page-level message is the domain sentence, never the server's English one.
      expect(result.current.error).toBe(IDENTIFIER_CONFLICT_MESSAGE);
    });
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it('rejects with the original error and reports a transport failure', async () => {
    API_KEYS_SERVICE_MOCK.createMock.mockRejectedValueOnce(createNetworkError());

    const { result } = renderHook(() => useCreateApiKeyMutation(), {
      wrapper: createWrapper(client),
    });

    let caught: unknown = null;

    await act(async () => {
      try {
        await result.current.createApiKey(CREATE_API_KEY_INPUT_FIXTURE);
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect(toIdentifierFieldError(caught)).toBeNull();
    await waitFor(() => {
      expect(result.current.error).toBe(NETWORK_ERROR_USER_MESSAGE);
    });
  });

  it('clears error and success state on reset', async () => {
    API_KEYS_SERVICE_MOCK.createMock.mockRejectedValueOnce(
      createConflictError(),
    );

    const { result } = renderHook(() => useCreateApiKeyMutation(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      try {
        await result.current.createApiKey(CREATE_API_KEY_INPUT_FIXTURE);
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
