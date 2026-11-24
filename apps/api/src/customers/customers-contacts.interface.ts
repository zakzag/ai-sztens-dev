/**
 * Server-side view types of the customer-contacts feature (AIS-178, slice d).
 *
 * The wire types live in `@callback/shared` (`Contact`, `ContactList`, …); what is
 * declared here is what the **repository** returns and what the **service** hands
 * to the controller. `ContactWithRoles` is reused from the parent feature instead
 * of being redeclared — the detail response and the contacts list publish the same
 * row shape, so a second type would be a second truth.
 */

import type { Contact, ContactRole, PaginationMeta } from '@callback/shared';
import type { ContactWithRoles } from './customers.interface.js';

/**
 * The column subset a `PATCH …/contacts/:contactId` may write.
 *
 * The same two rules as `CustomerPatch`:
 *
 * - `id`, `customerId`, `createdAt`, `deletedAt` are server-owned identity;
 * - `updatedAt` is the concurrency token and is only ever **compared**, never
 *   written (the column is maintained by `$onUpdate`).
 *
 * The roles are **not** here: they live in `contact_roles`, a table of their own,
 * and are written through {@link ContactRolesInput} in the same transaction.
 */
export interface ContactPatch {
  readonly name?: string;
  readonly position?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly customerUserId?: string | null;
  readonly isActive?: boolean;
}

/**
 * A role set to write, replacing whatever the contact had.
 *
 * A set and not a delta on purpose (AIS-178/d `D2`): "which roles does this
 * contact hold" is the fact the client edits, and replacing it atomically keeps
 * the `primary` uniqueness rule answerable in a single statement pair.
 */
export interface ContactRolesInput {
  readonly roles: readonly ContactRole[];
}

/** One page of contacts plus the size of the whole result set. */
export interface ContactPage {
  /** The contacts of the requested page, each with its roles. */
  readonly rows: readonly ContactWithRoles[];

  /** Matching rows across all pages. */
  readonly total: number;
}

/** The service's answer to the list controller: payload rows plus the pager. */
export interface PaginatedContacts {
  /** The **mapped** contacts of the page, ready for the envelope. */
  readonly items: readonly Contact[];

  /** Paging block built by the shared `toPaginationMeta`. */
  readonly pagination: PaginationMeta;
}
