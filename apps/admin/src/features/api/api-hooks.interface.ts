/**
 * Types shared by the generic hook layer (AIS-114).
 *
 * The three hooks in this folder exist so a page never re-implements the four
 * UI states. They all speak the same failure language, declared once here:
 *
 * - `error` — the normalised `ApiError`, so a caller that needs `requestId` or
 *   `issues[]` (log tier, field mapping) still has it;
 * - `errorMessage` — the single Hungarian mapping (`toErrorMessage`), i.e. what
 *   the user may read;
 * - `errorSurface` — the tier that owns the failure (`page` / `banner` /
 *   `field` / `silent`), so the same sentence can never be rendered twice.
 */

import type { ApiError } from '@callback/api-client';
import type { ApiResult } from '@callback/shared';
import type { ErrorSurface } from '../../lib/error-surface.interface.js';

/** The failure projection every hook returns. */
export interface ApiErrorView {
  /** The normalised API failure, or `null` when none (or not an `ApiError`). */
  readonly error: ApiError | null;
  /** User-facing message, already mapped; `null` when there is no failure. */
  readonly errorMessage: string | null;
  /** Tier the failure belongs to, or `null` when there is no failure. */
  readonly errorSurface: ErrorSurface | null;
}

/**
 * `meta` of one paginated response.
 *
 * Derived from the shared `ApiResult` instead of redeclaring the fields, so the
 * hook cannot drift from the transport: `pagination` is guaranteed to be there
 * by the schema that produced it.
 */
export type PaginatedMeta<TRows> = ApiResult<TRows>['meta'];

/**
 * A query function as the hooks accept it.
 *
 * Deliberately parameterless: the transport supports an abort `signal`
 * (`RequestOptions`), but TanStack's signal cannot be forwarded here — MSW's
 * Node interceptor rejects a `RequestInit` carrying a jsdom `AbortSignal`, which
 * is exactly the harness every admin test uses. Cancellation therefore stays a
 * TanStack-internal concern (its `CancelledError` still reaches the `silent`
 * tier); wiring a real abort has to wait for a harness that supports it.
 *
 * @typeParam TData - what the service resolves to (`ApiResult` for a list).
 */
export type ApiQueryFn<TData> = () => Promise<TData>;
