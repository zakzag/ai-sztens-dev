/**
 * Server-side view types of the customer-activities feature (AIS-178, slice f).
 *
 * The wire types live in `@callback/shared` (`Activity`); what is declared here
 * is what the **repository** returns and what the **service** hands to the
 * controller. Nothing here is a second copy of a contract type.
 */

import type { Activity, PaginationMeta } from '@callback/shared';
import type { ActivityRow } from '../db/schema.js';

/**
 * The column subset a `PATCH …/activities/:activityId` may write.
 *
 * Two rules, and both are load-bearing:
 *
 * - `id`, `customerId`, `authorType`, `operatorId`, `customerUserId`,
 *   `authorName`, `createdAt` and `deletedAt` are server-owned — the author in
 *   particular can never be rewritten by a client (`F3`);
 * - `undefined` means "leave the column alone" and `null` means "clear it", which
 *   is why the patch is built by presence and not by truthiness (`P7`).
 *
 * `updatedAt` is **not** part of the patch: the repository writes it explicitly
 * (`P9`), because `activities.updated_at` is nullable and has no `$onUpdate`.
 */
export interface ActivityPatch {
  /** New entry text, when the body carried one. */
  readonly body?: string;

  /** New payload, or `null` to clear it. */
  readonly metadata?: Record<string, unknown> | null;
}

/** One page of activities plus the size of the whole result set. */
export interface ActivityPage {
  /** The live activities of the requested page, in the requested order. */
  readonly rows: readonly ActivityRow[];

  /** Matching rows across all pages. */
  readonly total: number;
}

/** The service's answer to the list controller: payload rows plus the pager. */
export interface PaginatedActivities {
  /** The **mapped** activities of the page, ready for the envelope. */
  readonly items: readonly Activity[];

  /** Paging block built by the shared `toPaginationMeta`. */
  readonly pagination: PaginationMeta;
}
