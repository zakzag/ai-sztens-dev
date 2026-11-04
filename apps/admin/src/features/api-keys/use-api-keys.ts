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
  UpdateApiKeyInput,
} from '@callback/shared';
import { useApiDetail } from '../api/use-api-detail.js';
import { useApiList } from '../api/use-api-list.js';
import { useApiMutation } from '../api/use-api-mutation.js';
import { apiKeysService } from '../../services/api-client.js';
import { API_KEYS_QUERY_KEYS, EMPTY_API_KEY_LIST } from './api-keys.const.js';
import type {
  UseApiKeyDetailQueryResult,
  UseApiKeysQueryResult,
  UseCreateApiKeyMutationOptions,
  UseCreateApiKeyMutationResult,
  UseDeleteApiKeyMutationOptions,
  UseDeleteApiKeyMutationResult,
  UseUpdateApiKeyMutationOptions,
  UseUpdateApiKeyMutationResult,
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

/**
 * Reads one stored key by its identifier (AIS-131).
 *
 * An adapter over {@link useApiDetail}, like the list hook is over `useApiList`:
 * the query key comes from `api-keys.const.ts`, the service call from the
 * composition root, and the four UI states from the generic layer. A `404` is
 * not “no data” — it reaches the page as an `ApiError` with `page` surface.
 *
 * @param identifier - the value of the `:identifier` route parameter.
 * @param enabled - `false` skips the request (no identifier in the URL yet).
 * @returns the key, the four UI states and `refetch`.
 */
export function useApiKeyDetailQuery(
  identifier: string,
  enabled = true,
): UseApiKeyDetailQueryResult {
  const detail = useApiDetail<ApiKey>({
    queryKey: API_KEYS_QUERY_KEYS.detail(identifier),
    queryFn: () => apiKeysService.findByIdentifier(identifier),
    enabled,
  });

  return {
    data: detail.data,
    isLoading: detail.isLoading,
    isFetching: detail.isFetching,
    error: detail.error,
    errorMessage: detail.errorMessage,
    errorSurface: detail.errorSurface,
    refetch: detail.refetch,
  };
}

/**
 * Patches one key and refreshes every `api-keys` query.
 *
 * The invalidation runs **before** `onUpdated`, so a handler that closes an
 * editor cannot leave a stale detail or list behind. The identifier is bound
 * here rather than passed through the variables, because the body schema is
 * `.strict()` and must never carry an address of its own.
 *
 * @param identifier - which key is being patched (the route parameter).
 * @param options - optional `onUpdated` callback.
 * @returns the submit function, the pending/success flags and the failure view.
 */
export function useUpdateApiKeyMutation(
  identifier: string,
  options: UseUpdateApiKeyMutationOptions = {},
): UseUpdateApiKeyMutationResult {
  const { onUpdated } = options;

  const mutation = useApiMutation<ApiKey, UpdateApiKeyInput>({
    mutationFn: (input: UpdateApiKeyInput) =>
      apiKeysService.update(identifier, input),
    invalidateKeys: [API_KEYS_QUERY_KEYS.all],
    onSuccess: onUpdated,
  });

  return {
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
    updateApiKey: mutation.mutateAsync,
    reset: () => {
      mutation.reset();
    },
  };
}

/**
 * Soft-deletes one key and refreshes every `api-keys` query (AIS-131).
 *
 * The delete is a mutation like any other: the page confirms it with
 * `ConfirmDialog`, the dialog stays open while `isPending`, and only a resolved
 * write closes it — a failed request must not erase the question the user just
 * answered.
 *
 * @param identifier - which key is being deleted (the route parameter).
 * @param options - optional `onDeleted` callback (the page navigates back here).
 * @returns the delete function, the pending/success flags and the failure view.
 */
export function useDeleteApiKeyMutation(
  identifier: string,
  options: UseDeleteApiKeyMutationOptions = {},
): UseDeleteApiKeyMutationResult {
  const { onDeleted } = options;

  const mutation = useApiMutation<null, void>({
    mutationFn: () => apiKeysService.remove(identifier),
    invalidateKeys: [API_KEYS_QUERY_KEYS.all],
    onSuccess: () => {
      onDeleted?.();
    },
  });

  return {
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
    deleteApiKey: mutation.mutateAsync,
    reset: () => {
      mutation.reset();
    },
  };
}
