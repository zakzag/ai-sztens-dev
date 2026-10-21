/**
 * Types of the `api-keys` use case.
 *
 * The hooks return these *narrow* shapes instead of TanStack Query's
 * `UseQueryResult` / `UseMutationResult`: a page then cannot accidentally depend
 * on `dataUpdatedAt`, `failureCount` and friends, and the mapping from
 * query-state to UI-state happens in exactly one place (the hook).
 */

import type { ApiKey, CreateApiKeyInput } from '@callback/shared';

/** Read side: the stored keys plus the three UI states the table renders. */
export interface UseApiKeysQueryResult {
  /** The keys, newest first; `[]` while loading and after a failure. */
  readonly apiKeys: readonly ApiKey[];
  /** `true` until the first response (or failure) arrives. */
  readonly isLoading: boolean;
  /** User-facing message, already mapped by `toErrorMessage`; `null` if none. */
  readonly error: string | null;
  /** Manual retry for the error state. */
  readonly refetch: () => void;
}

/** Callbacks the page can hook into the create mutation. */
export interface UseCreateApiKeyMutationOptions {
  /**
   * Called after a successful create **and** after the list invalidation was
   * scheduled — the natural place to reset the form.
   */
  readonly onCreated?: (created: ApiKey) => void;
}

/** Write side: create one key, then refresh the list. */
export interface UseCreateApiKeyMutationResult {
  /** `true` while the request is in flight; the submit button must be disabled. */
  readonly isPending: boolean;
  /** `true` after a successful create, until {@link reset} or the next create. */
  readonly isSuccess: boolean;
  /** User-facing message, already mapped by `toErrorMessage`; `null` if none. */
  readonly error: string | null;
  /**
   * Submits the payload.
   *
   * Rejects with the original error (usually an `ApiError`), so the form can map
   * it onto a field via `toIdentifierFieldError`.
   */
  readonly createApiKey: (input: CreateApiKeyInput) => Promise<ApiKey>;
  /** Clears `error`/`isSuccess` — used when the form is reopened. */
  readonly reset: () => void;
}
