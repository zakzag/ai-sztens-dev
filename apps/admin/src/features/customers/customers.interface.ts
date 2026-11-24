/**
 * Types of the `customers` use case (AIS-19).
 *
 * Kept narrower than the generic hook layer: the page receives only what it
 * renders, so a mistake in the page cannot reach the query object.
 */

import type { Customer } from '@callback/shared';
import type {
  ApiErrorView,
  PaginatedMeta,
} from '../api/api-hooks.interface.js';

/**
 * Result of {@link useCustomersList}.
 *
 * `meta` is the `meta` block of the envelope (`pagination` plus the correlation
 * fields), or `null` while the first response has not arrived — which is what
 * lets the page decide whether a pager exists at all.
 */
export interface CustomersListResult extends ApiErrorView {
  /** Rows of the current page; the frozen empty list until a response arrives. */
  readonly customers: readonly Customer[];
  /** `meta.pagination` of the current response, or `null` before the first one. */
  readonly meta: PaginatedMeta<readonly Customer[]> | null;
  /** `true` until the first response (or failure) arrives. */
  readonly isLoading: boolean;
  /** `true` while any request is in flight, including a manual refetch. */
  readonly isFetching: boolean;
  /** Manual retry for the error state. */
  readonly refetch: () => void;
}

/**
 * Result of {@link useArchiveCustomerMutation}.
 *
 * `archiveCustomer` resolves with `null` because the soft delete answers
 * `200` with `data: null`; a caller that ignored the value could not tell the
 * two apart, so the type says it explicitly.
 */
export interface UseArchiveCustomerResult extends ApiErrorView {
  /** Performs the archive (soft delete) of one customer. */
  readonly archiveCustomer: (id: string) => Promise<null>;
  /** `true` while the write is in flight; disables the confirm button. */
  readonly isPending: boolean;
}
