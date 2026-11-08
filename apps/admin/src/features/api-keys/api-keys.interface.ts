/**
 * Types of the `api-keys` use case.
 *
 * The hooks return these *narrow* shapes instead of TanStack Query's
 * `UseQueryResult` / `UseMutationResult`: a page then cannot accidentally depend
 * on `dataUpdatedAt`, `failureCount` and friends, and the mapping from
 * query-state to UI-state happens in exactly one place (the hook).
 */

import type { ApiError } from '@callback/api-client';
import type {
  ApiKey,
  CreateApiKeyInput,
  UpdateApiKeyInput,
} from '@callback/shared';
import type {
  ApiErrorView,
  PaginatedMeta,
} from '../api/api-hooks.interface.js';
import type { ErrorSurface } from '../../lib/error-surface.interface.js';

/**
 * The inputs the create form owns.
 *
 * Declared in the feature layer (not in the page) because the shared
 * `toFieldErrors` has to decide whether a server `path` is addressable; the page
 * derives its `ApiKeyFormValues` from this union, so the two can never drift
 * apart while the import still only flows `pages → features`.
 *
 * The failure → field mapping itself is generic
 * (`lib/field-errors.logic.ts`): this union is the target it receives, and the
 * result type is `FieldErrorMapping<ApiKeyFormFieldName>`.
 */
export type ApiKeyFormFieldName =
  'name' | 'identifier' | 'description' | 'apiKey' | 'expiresAt';

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
  /** The keys of the current page; `[]` while loading and after a failure. */
  readonly apiKeys: readonly ApiKey[];
  /**
   * `meta.pagination` of the current page, or `null` until a response arrives.
   *
   * Exposed since AIS-114: the pager primitives (AIS-116) read `total` and
   * `totalPages` from here, so no page has to re-derive them.
   */
  readonly meta: PaginatedMeta<readonly ApiKey[]> | null;
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

/**
 * The fields the **edit** form owns (AIS-131).
 *
 * Strictly narrower than {@link ApiKeyFormFieldName}: `identifier` is the URL of
 * the resource and cannot be renamed (`updateApiKeySchema` is `.strict()` and
 * rejects it), and `apiKey` is the stored token — rotating it is a separate,
 * auditable flow (AIS-75), not a side effect of editing a description.
 */
export type ApiKeyEditFieldName = 'name' | 'description' | 'expiresAt';

/**
 * Read side of one key: the resource plus the four UI states.
 *
 * `data === null` means “no response yet”, never “not found”: a `404` is an
 * `ApiError` and is reported through `error`/`errorSurface`, so a page cannot
 * confuse a missing key with a slow one.
 */
export interface UseApiKeyDetailQueryResult extends ApiErrorView {
  /** The key, or `null` until a response arrives. */
  readonly data: ApiKey | null;
  /** `true` until the first response (or failure) arrives. */
  readonly isLoading: boolean;
  /** `true` while any request is in flight, including a manual refetch. */
  readonly isFetching: boolean;
  /** Manual retry for the error state. */
  readonly refetch: () => void;
}

/** Callbacks the page can hook into the update mutation. */
export interface UseUpdateApiKeyMutationOptions {
  /** Called after a successful write **and** after the cache invalidation. */
  readonly onUpdated?: (updated: ApiKey) => void;
}

/** Write side: patch one key, then refresh every `api-keys` query. */
export interface UseUpdateApiKeyMutationResult {
  /** `true` while the request is in flight; the submit button must be disabled. */
  readonly isPending: boolean;
  /** `true` after a successful write, until {@link reset}. */
  readonly isSuccess: boolean;
  /** The normalised API failure, or `null` when none. */
  readonly error: ApiError | null;
  /** User-facing message, already mapped by `toErrorMessage`; `null` if none. */
  readonly errorMessage: string | null;
  /** Tier the failure belongs to, or `null` when there is no failure. */
  readonly errorSurface: ErrorSurface | null;
  /**
   * Sends the changed fields plus the `updatedAt` token.
   *
   * Rejects with the original error, so the form can map it onto its fields.
   */
  readonly updateApiKey: (input: UpdateApiKeyInput) => Promise<ApiKey>;
  /** Clears `error`/`isSuccess` — used when the form is reopened. */
  readonly reset: () => void;
}

/** Callbacks the page can hook into the delete mutation. */
export interface UseDeleteApiKeyMutationOptions {
  /** Called after a successful delete **and** after the cache invalidation. */
  readonly onDeleted?: () => void;
}

/** Write side: soft-delete one key, then refresh every `api-keys` query. */
export interface UseDeleteApiKeyMutationResult {
  /** `true` while the request is in flight; the dialog must stay open. */
  readonly isPending: boolean;
  /** `true` after a successful delete, until {@link reset}. */
  readonly isSuccess: boolean;
  /** The normalised API failure, or `null` when none. */
  readonly error: ApiError | null;
  /** User-facing message, already mapped by `toErrorMessage`; `null` if none. */
  readonly errorMessage: string | null;
  /** Tier the failure belongs to, or `null` when there is no failure. */
  readonly errorSurface: ErrorSurface | null;
  /** Performs the delete; resolves to `null` (the success envelope's `data`). */
  readonly deleteApiKey: () => Promise<null>;
  /** Clears `error`/`isSuccess` — used when the dialog is reopened. */
  readonly reset: () => void;
}
