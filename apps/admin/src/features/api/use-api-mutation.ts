/**
 * The generic write (AIS-114).
 *
 * Wraps `useMutation` with the two rules the admin UI has to follow and that
 * used to be re-implemented per feature:
 *
 * 1. a successful write invalidates the query-key **prefixes** it was given —
 *    never a hand-patched cache entry, because a patched entry silently disagrees
 *    with the server the moment the write touched more than the edited row;
 * 2. the optional `meta.successMessage` is carried through untouched. The
 *    notification system (AIS-84) renders it; this hook must not depend on it,
 *    so the two tickets cannot block each other.
 *
 * The invalidation is awaited **before** the caller's `onSuccess`, so a handler
 * that closes the form there cannot leave a stale list behind.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  UseApiMutationOptions,
  UseApiMutationResult,
} from './use-api-mutation.interface.js';
import { toApiErrorView } from './api-hooks.logic.js';

/**
 * Performs one write and refreshes what it made stale.
 *
 * @param options - service call, keys to invalidate, feedback meta and `onSuccess`.
 * @returns the submit function, the four UI states and `reset`.
 */
export function useApiMutation<TData, TVariables>(
  options: UseApiMutationOptions<TData, TVariables>,
): UseApiMutationResult<TData, TVariables> {
  const queryClient = useQueryClient();
  const { mutationFn, invalidateKeys, meta, onSuccess } = options;

  const mutation = useMutation<TData, unknown, TVariables>({
    mutationFn,
    onSuccess: async (data: TData) => {
      if (invalidateKeys !== undefined && invalidateKeys.length > 0) {
        await Promise.all(
          invalidateKeys.map((queryKey) =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        );
      }

      onSuccess?.(data);
    },
  });

  return {
    mutateAsync: (variables: TVariables) => mutation.mutateAsync(variables),
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    ...toApiErrorView(mutation.error),
    successMessage: meta?.successMessage ?? null,
    reset: () => {
      mutation.reset();
    },
  };
}
