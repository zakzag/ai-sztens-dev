/**
 * SQL filter of the activity feed (AIS-178, slice f).
 *
 * A pure description of "which rows", kept out of the repository so the
 * repository stays a thin translation layer — the same split the parent feature
 * and the contacts feature use.
 *
 * Visibility has two parts, and both are load-bearing:
 *
 * - `customer_id = $id` — an activity is only ever reachable **inside its own
 *   customer**; guessing a uuid must not cross that boundary;
 * - `deleted_at IS NULL` — a soft-deleted entry disappears from the feed, which
 *   is also what makes `customers.last_activity_at` fall back to the previous
 *   entry (`F5`).
 *
 * The page query and the `count(*)` call the **same** function, so
 * `meta.pagination.total` can never count rows the page does not show.
 *
 * There is no search branch: `q` is not part of `activityListQuerySchema`
 * (`F7`), because the feed is strictly `created_at`-ordered and the index
 * (`activities_customer_created_idx`) cannot serve a free-text match.
 */

import { and, eq, isNull, type SQL } from 'drizzle-orm';
import { activities } from '../db/schema.js';

/**
 * The soft-delete filter: only activities that were never removed.
 *
 * @returns the `deleted_at IS NULL` expression.
 */
export function activityNotDeletedFilter(): SQL {
  return isNull(activities.deletedAt);
}

/**
 * The complete `WHERE` of every activity read.
 *
 * @param customerId - the customer the feed belongs to (always applied).
 * @returns the `customer_id = … AND deleted_at IS NULL` expression.
 */
export function activityVisibleFilter(customerId: string): SQL {
  return (
    and(eq(activities.customerId, customerId), activityNotDeletedFilter()) ??
    eq(activities.customerId, customerId)
  );
}
