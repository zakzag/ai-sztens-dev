/**
 * TanStack Query hooks of the `api-keys` use case.
 *
 * The page never calls the service (and therefore never `fetch`): it renders
 * what these two hooks expose. Responsibilities are split exactly along the
 * three state buckets of the React rules:
 *
 * - server state lives in the query cache (never copied into a store),
 * - a successful create invalidates the list (no hand-patched cache entries),
 * - the error → text mapping happens here, once, through `toErrorMessage`.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiKey, CreateApiKeyInput } from '@callback/shared';
import { toErrorMessage } from '../../lib/error-message.js';
import { toApiError, toErrorSurface } from '../../lib/error-surface.logic.js';
import { apiKeysService } from '../../services/api-client.js';
import { API_KEYS_QUERY_KEYS, EMPTY_API_KEY_LIST } from './api-keys.const.js';
import type {
  UseApiKeysQueryResult,
  UseCreateApiKeyMutationOptions,
  UseCreateApiKeyMutationResult,
} from './api-keys.interface.js';

/**
 * Reads the stored API keys.
 *
 * @returns the list plus explicit `isLoading` / `isFetching` / error fields and
 *   `refetch`, so the page can render all four states (loading / empty /
 *   error / success) without knowing anything about query objects.
 */
export function useApiKeysQuery(): UseApiKeysQueryResult {
  const query = useQuery({
    queryKey: API_KEYS_QUERY_KEYS.list,
    queryFn: () => apiKeysService.list(),
  });

  const { error } = query;

  return {
    apiKeys: query.data ?? EMPTY_API_KEY_LIST,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: toApiError(error),
    errorMessage: error === null ? null : toErrorMessage(error),
    errorSurface: error === null ? null : toErrorSurface(error),
    refetch: () => {
      void query.refetch();
    },
  };
}

/**
 * Creates one API key and refreshes the list afterwards.
 *
 * `invalidateQueries` is awaited before {@link UseCreateApiKeyMutationOptions.onCreated}
 * runs, so a caller that closes the form right there cannot leave a stale list
 * behind.
 *
 * @param options - optional `onCreated` callback (the form resets itself here).
 */
export function useCreateApiKeyMutation(
  options: UseCreateApiKeyMutationOptions = {},
): UseCreateApiKeyMutationResult {
  const queryClient = useQueryClient();
  const { onCreated } = options;

  const mutation = useMutation<ApiKey, unknown, CreateApiKeyInput>({
    mutationFn: (input: CreateApiKeyInput) => apiKeysService.create(input),
    onSuccess: async (created: ApiKey) => {
      await queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEYS.all });
      onCreated?.(created);
    },
  });

  return {
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error === null ? null : toErrorMessage(mutation.error),
    createApiKey: (input: CreateApiKeyInput) => mutation.mutateAsync(input),
    reset: () => {
      mutation.reset();
    },
  };
}
