/**
 * Types of the `customers` use case (AIS-19).
 *
 * Kept narrower than the generic hook layer: the page receives only what it
 * renders, so a mistake in the page cannot reach the query object.
 */

import type {
  Activity,
  AuditLog,
  Contact,
  CreateActivityInput,
  CreateContactInput,
  CreateCustomerInput,
  Customer,
  CustomerUser,
  InviteCustomerUserInput,
  UpdateActivityInput,
  UpdateContactInput,
  UpdateCustomerInput,
  UpdateCustomerStatusInput,
  UpdateCustomerUserInput,
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
 * Every input the **create wizard** owns, in visual order (AIS-182).
 *
 * The same closed-union contract as {@link CustomerUpdateFieldName}: the
 * field-path list, the code → path table and the wizard's step map are all
 * checked against it, so a renamed field breaks the build instead of silently
 * losing focus.
 *
 * The server-managed fields (`customerNumber`, `status`, `createdAt`,
 * `updatedAt`) are absent: `createCustomerSchema` is `.strict()` and defaults
 * them server-side, so they can never be an error target either.
 */
export type CustomerCreateFieldName =
  | 'legalName'
  | 'shortName'
  | 'taxNumber'
  | 'euVatNumber'
  | 'companyRegistrationNumber'
  | 'legalForm'
  | 'registeredAddressZip'
  | 'registeredAddressCity'
  | 'registeredAddressLine'
  | 'registeredAddressCountry';

/**
 * Result of {@link useCreateCustomerMutation} (AIS-182).
 *
 * The body is the whole draft, not a partial patch: `createCustomerSchema`
 * accepts absent optional fields and defaults the country, so the hook needs no
 * second parameter.
 */
export interface UseCreateCustomerResult extends ApiErrorView {
  /** Sends the create body; resolves with the created row. */
  readonly createCustomer: (input: CreateCustomerInput) => Promise<Customer>;
  /** `true` while the write is in flight; disables the submit button. */
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

/**
 * Every input the **contact** form owns (AIS-179).
 *
 * Roles are three booleans rather than the contract's `roles[]`: a set of three
 * checkboxes is what the form shows, and `toCreateContactInput()` is the single
 * place that turns the flags into the wire array (plan decision `D3`).
 */
export type CustomerContactFormFieldName =
  | 'name'
  | 'position'
  | 'email'
  | 'phone'
  | 'customerUserId'
  | 'isPrimary'
  | 'isTechnical'
  | 'isAlerting'
  | 'isActive';

/** Every input the **invite** form owns (AIS-179). */
export type CustomerUserInviteFormFieldName = 'name' | 'email' | 'role';

/** Every input the **login-user edit** form owns (AIS-179). */
export type CustomerUserEditFormFieldName = 'name' | 'role' | 'status';

/** Result of {@link useCreateContactMutation}. */
export interface UseCreateContactResult extends ApiErrorView {
  /** Adds one contact to the customer bound by the hook. */
  readonly createContact: (input: CreateContactInput) => Promise<Contact>;
  /** `true` while the write is in flight; disables the save button. */
  readonly isPending: boolean;
}

/**
 * Result of {@link useUpdateContactMutation}.
 *
 * Both the customer and the contact id are **bound** by the hook, exactly like
 * `useUpdateCustomerMutation` binds the customer id: the request body schemas are
 * `.strict()` and must never carry an address of their own.
 */
export interface UseUpdateContactResult extends ApiErrorView {
  /** Patches the bound contact; the body always carries `updatedAt`. */
  readonly updateContact: (input: UpdateContactInput) => Promise<Contact>;
  /** `true` while the write is in flight; disables the save button. */
  readonly isPending: boolean;
}

/** Result of {@link useRemoveContactMutation} — the contact id is bound. */
export interface UseRemoveContactResult extends ApiErrorView {
  /** Archives the bound contact; the soft delete answers `data: null`. */
  readonly removeContact: () => Promise<null>;
  /** `true` while the write is in flight; disables the confirm button. */
  readonly isPending: boolean;
}

/** Result of {@link useInviteCustomerUserMutation}. */
export interface UseInviteCustomerUserResult extends ApiErrorView {
  /** Sends one invitation. */
  readonly inviteCustomerUser: (
    input: InviteCustomerUserInput,
  ) => Promise<CustomerUser>;
  /** `true` while the write is in flight; disables the invite button. */
  readonly isPending: boolean;
}

/** Result of {@link useUpdateCustomerUserMutation} — both ids are bound. */
export interface UseUpdateCustomerUserResult extends ApiErrorView {
  /** Patches name, role and managed status; the body carries `updatedAt`. */
  readonly updateCustomerUser: (
    input: UpdateCustomerUserInput,
  ) => Promise<CustomerUser>;
  /** `true` while the write is in flight; disables the save button. */
  readonly isPending: boolean;
}

/** Result of {@link useRemoveCustomerUserMutation} — both ids are bound. */
export interface UseRemoveCustomerUserResult extends ApiErrorView {
  /** Revokes the bound **pending invitation**; answers `data: null`. */
  readonly removeCustomerUser: () => Promise<null>;
  /** `true` while the write is in flight; disables the confirm button. */
  readonly isPending: boolean;
}

/**
 * The two inputs the **activity note** form owns (AIS-181).
 *
 * `type` and `body` only: the author is a server-side decision (`author_*` comes
 * from the request context, `createActivitySchema` is `.strict()`), and
 * `metadata` has no control on this screen.
 */
export type CustomerActivityFormFieldName = 'type' | 'body';

/**
 * Result of {@link useCustomerActivities} (AIS-181).
 *
 * `meta` is the envelope's `meta`, or `null` before the first response — the same
 * shape the list hook exposes, so the tab's pager renders only once a page exists.
 */
export interface CustomerActivitiesResult extends ApiErrorView {
  /** Live activities of the current page; the frozen empty list until a response. */
  readonly activities: readonly Activity[];
  /** `meta.pagination` of the current response, or `null` before the first one. */
  readonly meta: PaginatedMeta<readonly Activity[]> | null;
  /** `true` until the first response (or failure) arrives. */
  readonly isLoading: boolean;
  /** `true` while any request is in flight, including a manual refetch. */
  readonly isFetching: boolean;
  /** Manual retry for the error state. */
  readonly refetch: () => void;
}

/** Result of {@link useCustomerAuditLogs} — the ledger's read-only counterpart. */
export interface CustomerAuditLogsResult extends ApiErrorView {
  /** Rows of the current page; the frozen empty list until a response. */
  readonly auditLogs: readonly AuditLog[];
  /** `meta.pagination` of the current response, or `null` before the first one. */
  readonly meta: PaginatedMeta<readonly AuditLog[]> | null;
  /** `true` until the first response (or failure) arrives. */
  readonly isLoading: boolean;
  /** `true` while any request is in flight, including a manual refetch. */
  readonly isFetching: boolean;
  /** Manual retry for the error state. */
  readonly refetch: () => void;
}

/** Result of {@link useCreateActivityMutation}. */
export interface UseCreateActivityResult extends ApiErrorView {
  /** Records one entry in the caller's name; the author is never in the body. */
  readonly createActivity: (input: CreateActivityInput) => Promise<Activity>;
  /** `true` while the write is in flight; disables the submit button. */
  readonly isPending: boolean;
}

/** Result of {@link useUpdateActivityMutation} — both ids are bound. */
export interface UseUpdateActivityResult extends ApiErrorView {
  /** Patches the bound entry; the body always carries the concurrency token. */
  readonly updateActivity: (input: UpdateActivityInput) => Promise<Activity>;
  /** `true` while the write is in flight; disables the save button. */
  readonly isPending: boolean;
}

/** Result of {@link useRemoveActivityMutation} — both ids are bound. */
export interface UseRemoveActivityResult extends ApiErrorView {
  /** Soft-deletes the bound entry; the endpoint answers `data: null`. */
  readonly removeActivity: () => Promise<null>;
  /** `true` while the write is in flight; disables the confirm button. */
  readonly isPending: boolean;
}
