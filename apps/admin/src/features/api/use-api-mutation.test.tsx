/**
 * Tests of {@link useApiMutation}.
 *
 * The hook owns two behaviours that used to be copy-pasted per feature, so both
 * are asserted through a **spy on the query client** rather than through a
 * component: which key prefix got invalidated, and that the caller's `onSuccess`
 * runs after it. The `successMessage` assertion is deliberately only a
 * pass-through check — rendering it is AIS-84's job.
 */

import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateApiKeyInput } from '@callback/shared';
import { ApiError } from '@callback/api-client';
import { SERVER_ERROR_MESSAGE } from '../../lib/error-message.const.js';
import { apiKeysService } from '../../services/api-client.js';
import {
  apiKeysCreateConflict,
  apiKeysCreatePending,
  apiKeysCreateServerError,
} from '../../test/mocks/handlers/api-keys.handlers.js';
import {
  createTestQueryClient,
  TestQueryProvider,
} from '../../test/mocks/query-client.mock.js';
import { server } from '../../test/mocks/server.js';
import { useApiMutation } from './use-api-mutation.js';

/** Minimal valid create payload every test submits. */
const CREATE_INPUT: CreateApiKeyInput = {
  name: 'Vapi staging',
  identifier: 'vapi-staging',
  apiKey: 'sk-stage-42',
};

/**
 * @param client - the query client of the test.
 * @returns the rendered mutation hook without invalidation keys.
 */
function renderMutation(client: QueryClient) {
  return renderHook(
    () =>
      useApiMutation({
        mutationFn: (input: CreateApiKeyInput) => apiKeysService.create(input),
      }),
    {
      wrapper: ({ children }) => (
        <TestQueryProvider client={client}>{children}</TestQueryProvider>
      ),
    },
  );
}

describe('useApiMutation', () => {
  let client: QueryClient;

  beforeEach(() => {
    server.resetHandlers();
    client = createTestQueryClient();
  });

  it('invalidates the given key prefixes and then calls onSuccess', async () => {
    const onSuccess = vi.fn();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn: (input: CreateApiKeyInput) =>
            apiKeysService.create(input),
          invalidateKeys: [['api-keys']],
          onSuccess,
        }),
      {
        wrapper: ({ children }) => (
          <TestQueryProvider client={client}>{children}</TestQueryProvider>
        ),
      },
    );

    await act(async () => {
      await result.current.mutateAsync(CREATE_INPUT);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['api-keys'] });
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: CREATE_INPUT.identifier }),
    );

    // The invalidation is awaited inside `onSuccess`, so the success flag is
    // published on the render that follows it — not on the awaited call itself.
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.error).toBeNull();
  });

  it('does not touch the cache when no keys were given', async () => {
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderMutation(client);

    await act(async () => {
      await result.current.mutateAsync(CREATE_INPUT);
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.error).toBeNull();
  });

  it('carries meta.successMessage through untouched', () => {
    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn: (input: CreateApiKeyInput) =>
            apiKeysService.create(input),
          meta: { successMessage: 'Az API kulcs létrejött.' },
        }),
      {
        wrapper: ({ children }) => (
          <TestQueryProvider client={client}>{children}</TestQueryProvider>
        ),
      },
    );

    expect(result.current.successMessage).toBe('Az API kulcs létrejött.');
  });

  it('reports null when no success message was supplied', () => {
    const { result } = renderMutation(client);

    expect(result.current.successMessage).toBeNull();
  });

  it('maps a 500 onto the page tier while keeping the raw error', async () => {
    server.use(apiKeysCreateServerError);

    const { result } = renderMutation(client);

    await act(async () => {
      await result.current.mutateAsync(CREATE_INPUT).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toBe(SERVER_ERROR_MESSAGE);
    });

    expect(result.current.errorSurface).toBe('page');
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it('rejects with the original ApiError so a form can map it', async () => {
    server.use(apiKeysCreateConflict);

    const { result } = renderMutation(client);

    let caught: unknown = null;

    await act(async () => {
      try {
        await result.current.mutateAsync(CREATE_INPUT);
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe('API_KEY_IDENTIFIER_CONFLICT');
  });

  it('clears error and success state on reset', async () => {
    server.use(apiKeysCreateServerError);

    const { result } = renderMutation(client);

    await act(async () => {
      await result.current.mutateAsync(CREATE_INPUT).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    act(() => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
    expect(result.current.isSuccess).toBe(false);
  });

  it('reports isPending while the request is in flight', async () => {
    server.use(apiKeysCreatePending);

    const { result } = renderMutation(client);

    act(() => {
      // Fire and forget: the handler never answers, so the promise stays open.
      void result.current.mutateAsync(CREATE_INPUT).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    expect(result.current.isSuccess).toBe(false);
  });
});
