/**
 * Types of the `customers` use case (AIS-19).
 *
 * Kept narrower than the generic hook layer: the page receives only what it
 * renders, so a mistake in the page cannot reach the query object.
 */

import type {
  Customer,
  UpdateCustomerInput,
  UpdateCustomerStatusInput,
} from '@callback/shared';
import type {
  ApiErrorView,
  PaginatedMeta,
} from '../api/api-hooks.interface.js';

/**
 * Every input the customer **edit** form owns (AIS-21).
 *
 * A closed union instead of a string: the field-path list, the default
 * path-by-code table and the page's form-value record are all checked against
 * it, so a renamed field breaks the build instead of silently losing focus.
 *
 * The read-only-by-contract fields (`customerNumber`, `status`, `createdAt`,
 * `updatedAt`, `hasMissingData`) are deliberately absent — `updateCustomerSchema`
 * is `.strict()` and rejects them, so they can never be an error target.
 */
export type CustomerUpdateFieldName =
  | 'type'
  | 'legalName'
  | 'shortName'
  | 'taxNumber'
  | 'euVatNumber'
  | 'companyRegistrationNumber'
  | 'legalForm'
  | 'registeredAddressZip'
  | 'registeredAddressCity'
  | 'registeredAddressLine'
  | 'registeredAddressCountry'
  | 'industry'
  | 'headcountRange'
  | 'source';

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

/**
 * Result of {@link useUpdateCustomerMutation} (AIS-21).
 *
 * The id is bound by the hook, not passed through the variables: the body schema
 * is `.strict()` and must never carry the resource's own address.
 */
export interface UseUpdateCustomerResult extends ApiErrorView {
  /** Sends the partial body (always with `updatedAt`) to `PATCH /:id`. */
  readonly updateCustomer: (input: UpdateCustomerInput) => Promise<Customer>;
  /** `true` while the write is in flight; disables the save button. */
  readonly isPending: boolean;
}

/**
 * Result of {@link useUpdateCustomerStatusMutation} (AIS-21).
 *
 * A route of its own (`PATCH /:id/status`): the status change also writes
 * `statusChangedAt` and is audited as its own operation, so it must not travel
 * inside the field update.
 */
export interface UseUpdateCustomerStatusResult extends ApiErrorView {
  /** Sends the new status plus the required concurrency token. */
  readonly updateCustomerStatus: (
    input: UpdateCustomerStatusInput,
  ) => Promise<Customer>;
  /** `true` while the write is in flight; disables the save button. */
  readonly isPending: boolean;
}
