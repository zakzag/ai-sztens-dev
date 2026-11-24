/**
 * Server-side view types of the `customers` feature (AIS-178).
 *
 * The wire contract lives in `@callback/shared` (`Customer`, `CustomerDetail`);
 * what is declared here is what the **repository** returns and what the
 * **service** hands to the controller — row shapes, the derived projections, and
 * the patch subset. Nothing here is a second copy of a contract type.
 */

import type {
  ContactRole,
  Customer,
  CustomerSource,
  CustomerStatus,
  CustomerType,
  HeadcountRange,
  PaginationMeta,
} from '@callback/shared';
import type {
  ContactRow,
  CustomerRow,
  CustomerUserRow,
  TagRow,
} from '../db/schema.js';

/**
 * A customer row plus the two **derived** projections of the list (AIS-178).
 *
 * - `lastActivityAt` — `max(activities.created_at)` of the live activities; it
 *   is not a column, so storing it would create a second truth;
 * - `primaryContactName` — the name of the live contact with the `primary` role
 *   (AIS-17 `D9`, the list column), `null` when no such contact exists.
 *
 * Both come from the same round trip as the row itself: the page query projects
 * them, which is what keeps the list at a fixed two queries (page + count)
 * instead of 2 + N.
 */
export interface CustomerListRow extends CustomerRow {
  /** Newest live activity timestamp, or `null` when nothing was recorded. */
  readonly lastActivityAt: Date | null;

  /** Name of the primary contact, or `null` when none is set. */
  readonly primaryContactName: string | null;
}

/** One live contact with the roles it holds. */
export interface ContactWithRoles {
  /** The contact row itself. */
  readonly contact: ContactRow;

  /**
   * The roles of `contact_roles` belonging to it, in query order (possibly
   * empty). The array itself is mutable because the mapper appends while
   * grouping; the property is not.
   */
  readonly roles: ContactRole[];
}

/**
 * One row of the `contacts ⋈ contact_roles` left join.
 *
 * `role` is `null` for a contact that has no role row at all — the left join
 * keeps such a contact in the result, which is exactly what “a contact with no
 * role yet” has to look like.
 */
export interface ContactRoleJoinRow {
  /** The contact row of the join. */
  readonly contact: ContactRow;

  /** One of its roles, or `null` when it has none. */
  readonly role: ContactRole | null;
}

/**
 * Everything the detail response needs, read in at most four round trips.
 *
 * The parent carries the same two derived projections as the list, so the detail
 * schema can stay an extension of the list schema (one field set, one mapping).
 */
export interface CustomerDetailRows {
  /** The parent row with its derived projections. */
  readonly customer: CustomerListRow;

  /** Attached tags, in catalogue order of the query. */
  readonly tags: readonly TagRow[];

  /** Live contacts, each with its roles. */
  readonly contacts: readonly ContactWithRoles[];

  /** Login users of the customer. */
  readonly customerUsers: readonly CustomerUserRow[];
}

/**
 * The column subset a `PATCH /:id` may write.
 *
 * Two families are deliberately absent, and both are type-level guarantees
 * rather than review notes:
 *
 * - `id`, `customerNumber`, `createdAt`, `deletedAt` — server-owned identity;
 * - `updatedAt` — the optimistic-concurrency token is only ever **compared**,
 *   never written (the column is maintained by `$onUpdate`).
 *
 * `status` is absent too: it has its own endpoint, because a status change must
 * also write `status_changed_at` (see {@link CustomerStatusPatch}).
 *
 * Every field is optional in the `undefined` sense: an absent key means “leave
 * the column untouched”, an explicit `null` clears it. The mapper is the only
 * place that builds this shape, so those two cases cannot be confused.
 */
export interface CustomerPatch {
  readonly type?: CustomerType;
  readonly legalName?: string;
  readonly shortName?: string | null;
  readonly taxNumber?: string | null;
  readonly euVatNumber?: string | null;
  readonly companyRegistrationNumber?: string | null;
  readonly legalForm?: string | null;
  readonly registeredAddressZip?: string | null;
  readonly registeredAddressCity?: string | null;
  readonly registeredAddressLine?: string | null;
  readonly registeredAddressCountry?: string;
  readonly industry?: string | null;
  readonly headcountRange?: HeadcountRange | null;
  readonly source?: CustomerSource | null;
}

/**
 * The two columns a status change writes, always together.
 *
 * Returned by the pure `toStatusPatch()` so a caller cannot write `status`
 * without `status_changed_at` (and cannot invent a third field).
 */
export interface CustomerStatusPatch {
  readonly status: CustomerStatus;
  readonly statusChangedAt: Date;
}

/** One page of customers, ready to be wrapped in the success envelope. */
export interface PaginatedCustomers {
  /** The rows of the requested page, mapped to the wire contract. */
  readonly items: readonly Customer[];

  /** The `meta.pagination` block of the response. */
  readonly pagination: PaginationMeta;
}
