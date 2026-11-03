/**
 * TanStack Query hooks of the `api-keys` use case.
 *
 * Since AIS-114 these are **adapters**, not implementations: the state wiring
 * lives in the generic [`features/api`](../api) hooks, and this file only keeps
 * what is specific to the resource — the service call, the query key and the
 * stable empty list. Responsibilities are still split along the three state
 * buckets of the React rules:
 *
 * - server state lives in the query cache (never copied into a store),
 * - a successful create invalidates the `api-keys` prefix (no hand-patched
 *   cache entries),
 * - the error → text mapping happens once, inside the generic hook.
 */

import type {
  ApiKey,
  ApiKeyListQuery,
  CreateApiKeyInput,
} from '@callback/shared';
import { useApiList } from '../api/use-api-list.js';
import { useApiMutation } from '../api/use-api-mutation.js';
import { apiKeysService } from '../../services/api-client.js';
import { API_KEYS_QUERY_KEYS, EMPTY_API_KEY_LIST } from './api-keys.const.js';
import type {
  UseApiKeysQueryResult,
  UseCreateApiKeyMutationOptions,
  UseCreateApiKeyMutationResult,
} from './api-keys.interface.js';

/**
 * Reads one page of stored API keys.
 *
 * @param params - the validated list query, normally the URL params from
 *   `useListParams`; it is part of the query key, so a page change refetches.
 * @returns the rows, `meta.pagination` and the explicit `isLoading` /
 *   `isFetching` / error fields, so the page can render all four states without
 *   knowing anything about query objects.
 */
export function useApiKeysQuery(
  params: ApiKeyListQuery,
): UseApiKeysQueryResult {
  const { data: apiKeys, ...listState } = useApiList<readonly ApiKey[]>({
    queryKey: API_KEYS_QUERY_KEYS.list(params),
    queryFn: () => apiKeysService.list(params),
    emptyData: EMPTY_API_KEY_LIST,
  });

  return { apiKeys, ...listState };
}

/**
 * Creates one API key and refreshes every `api-keys` query afterwards.
 *
 * The invalidation is awaited before {@link UseCreateApiKeyMutationOptions.onCreated}
 * runs, so a caller that closes the form right there cannot leave a stale list
 * behind.
 *
 * @param options - optional `onCreated` callback (the form resets itself here).
 */
export function useCreateApiKeyMutation(
  options: UseCreateApiKeyMutationOptions = {},
): UseCreateApiKeyMutationResult {
  const { onCreated } = options;

  const mutation = useApiMutation<ApiKey, CreateApiKeyInput>({
    mutationFn: (input: CreateApiKeyInput) => apiKeysService.create(input),
    invalidateKeys: [API_KEYS_QUERY_KEYS.all],
    onSuccess: onCreated,
  });

  return {
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.errorMessage,
    createApiKey: mutation.mutateAsync,
    reset: () => {
      mutation.reset();
    },
  };
}
