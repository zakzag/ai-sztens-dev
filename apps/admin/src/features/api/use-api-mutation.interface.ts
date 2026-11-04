/**
 * Types of {@link useApiMutation} (AIS-114).
 *
 * Two decisions are visible in these types:
 *
 * - invalidation is **data**, not behaviour: the caller lists the query-key
 *   prefixes that the write makes stale, and the hook does the one correct thing
 *   (`invalidateQueries`) instead of letting every caller hand-patch the cache;
 * - `successMessage` is only **carried**, never shown: the notification system
 *   (AIS-84) owns the rendering, so the hook stays free of it.
 */

import type { QueryKey } from '@tanstack/react-query';
import type { ApiErrorView } from './api-hooks.interface.js';

/** Optional feedback metadata of a mutation. */
export interface ApiMutationMeta {
  /**
   * Copy the global notification layer should show on success.
   *
   * `null`/`undefined` means “nothing to announce”; the hook never renders it.
   */
  readonly successMessage?: string;
}

/** Inputs of {@link useApiMutation}. */
export interface UseApiMutationOptions<TData, TVariables> {
  /** The service call that performs the write. */
  readonly mutationFn: (variables: TVariables) => Promise<TData>;
  /**
   * Optional identity of the write, e.g. `['api-keys', 'create']`.
   *
   * It is not used for caching — it is what the global notification layer puts
   * into the `detail` field of a failure (AIS-84), so the log says *which* write
   * failed instead of only *that* one did.
   */
  readonly mutationKey?: QueryKey;
  /**
   * Query-key prefixes to invalidate after a successful write.
   *
   * Prefixes, not exact keys: `['api-keys']` refreshes every `api-keys` query
   * (list and detail) without the caller knowing their shape.
   */
  readonly invalidateKeys?: readonly QueryKey[];
  /** Feedback metadata, carried through to the result untouched. */
  readonly meta?: ApiMutationMeta;
  /** Called after the invalidation was scheduled (e.g. to close a form). */
  readonly onSuccess?: (data: TData) => void;
}

/** Result of {@link useApiMutation}. */
export interface UseApiMutationResult<TData, TVariables> extends ApiErrorView {
  /**
   * Submits the payload.
   *
   * Rejects with the original error (usually an `ApiError`), so a form can still
   * map it onto its fields.
   */
  readonly mutateAsync: (variables: TVariables) => Promise<TData>;
  /** `true` while the request is in flight; the trigger must be disabled. */
  readonly isPending: boolean;
  /** `true` after a successful write, until {@link reset} or the next call. */
  readonly isSuccess: boolean;
  /** `meta.successMessage`, or `null` when the caller supplied none. */
  readonly successMessage: string | null;
  /** Clears `error`/`isSuccess` — used when a form is reopened. */
  readonly reset: () => void;
}
