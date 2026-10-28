/**
 * Types of the `api-keys` use case.
 *
 * The hooks return these *narrow* shapes instead of TanStack Query's
 * `UseQueryResult` / `UseMutationResult`: a page then cannot accidentally depend
 * on `dataUpdatedAt`, `failureCount` and friends, and the mapping from
 * query-state to UI-state happens in exactly one place (the hook).
 */

import type { ApiError } from '@callback/api-client';
import type { ApiKey, CreateApiKeyInput } from '@callback/shared';
import type { ErrorSurface } from '../../lib/error-surface.interface.js';

/**
 * The inputs the create form owns.
 *
 * Declared in the feature layer (not in the page) because `toFieldErrors` has to
 * decide whether a server `path` is addressable; the page derives its
 * `ApiKeyFormValues` from this union, so the two can never drift apart while the
 * import still only flows `pages → features`.
 */
export type ApiKeyFormFieldName =
  | 'name'
  | 'identifier'
  | 'description'
  | 'apiKey'
  | 'expiresAt';

/**
 * Result of mapping a failure onto the form.
 *
 * `fields` holds one message per identified input, `form` the single message the
 * page `Alert` renders (plan `D11`, tiers 1 and 2). The two are exclusive per
 * failure part: a path that maps produces no page copy.
 */
export interface ApiKeyFieldErrors {
  /** Field-level messages, keyed by react-hook-form field name. */
  readonly fields: Partial<Record<ApiKeyFormFieldName, string>>;
  /** Page-level message, or `null` when every issue landed on a field. */
  readonly form: string | null;
}

/**
 * Read side: the stored keys plus everything the four UI states need.
 *
 * The failure is exposed in three forms on purpose (plan `D11`): the raw error
 * keeps `requestId` for the log tier (AIS-86), the message is the single
 * `toErrorMessage` mapping, and the surface is the classifier's verdict that
 * decides *which* component may render the failure — so the page cannot show the
 * banner's sentence a second time inside an alert.
 */
export interface UseApiKeysQueryResult {
  /** The keys, newest first; `[]` while loading and after a failure. */
  readonly apiKeys: readonly ApiKey[];
  /** `true` until the first response (or failure) arrives. */
  readonly isLoading: boolean;
  /** `true` while any request is in flight, including a manual refetch. */
  readonly isFetching: boolean;
  /** The normalised API failure, or `null` when none (or not an `ApiError`). */
  readonly error: ApiError | null;
  /** User-facing message, already mapped by `toErrorMessage`; `null` if none. */
  readonly errorMessage: string | null;
  /** Tier the failure belongs to, or `null` when there is no failure. */
  readonly errorSurface: ErrorSurface | null;
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
   * it onto fields via `toFieldErrors`.
   */
  readonly createApiKey: (input: CreateApiKeyInput) => Promise<ApiKey>;
  /** Clears `error`/`isSuccess` — used when the form is reopened. */
  readonly reset: () => void;
}
