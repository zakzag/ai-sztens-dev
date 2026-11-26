/**
 * Pure mapping of the customer activity feed (AIS-181).
 *
 * The feed arrives as wire rows with machine kinds and ISO instants; the tab needs
 * labels, badge variants and formatted times. Every decision is made here, once,
 * so no component has to know what an `authorType` means or which variant a `call`
 * gets.
 *
 * The `D-W4` rule lives here too: `canEdit` is `authorType === 'operator'`, i.e.
 * only an entry an operator wrote may be edited or deleted. That is a **client**
 * rule on purpose — the API checks no author until authentication lands
 * (AIS-73/74).
 */

import type { Activity, AuthorType } from '@callback/shared';
import { formatDateTime } from '../../lib/date.js';
import {
  CUSTOMER_ACTIVITY_TYPE_LABELS,
  CUSTOMER_ACTIVITY_TYPE_VARIANTS,
  CUSTOMER_AUDIT_ACTOR_TYPE_LABELS,
} from './customer.const.js';
import type {
  CustomerActivityViewModel,
  CustomerActivityViewModels,
} from './customer.interface.js';

/**
 * @param authorType - kind of the entry's author.
 * @returns `true` when the row may offer edit and delete (`D-W4`).
 */
export function canEditActivity(authorType: AuthorType): boolean {
  return authorType === 'operator';
}

/**
 * The concurrency token of one entry (AIS-181 `D13`).
 *
 * `activities.updated_at` is nullable and means “never edited”, so the last write
 * instant is `updatedAt ?? createdAt`. Sending `updatedAt` alone would make the
 * **first** edit of every entry a `409`.
 *
 * @param activity - the wire row.
 * @returns the ISO instant to send back in a `PATCH`.
 */
export function toActivityUpdateToken(
  activity: Pick<Activity, 'updatedAt' | 'createdAt'>,
): string {
  return activity.updatedAt ?? activity.createdAt;
}

/**
 * Maps one wire row to its view model.
 *
 * @param activity - one entry of the feed.
 * @returns the row, with labels, variant, formatted time and the edit verdict.
 */
export function toCustomerActivityViewModel(
  activity: Activity,
): CustomerActivityViewModel {
  return {
    id: activity.id,
    type: activity.type,
    typeLabel: CUSTOMER_ACTIVITY_TYPE_LABELS[activity.type],
    typeVariant: CUSTOMER_ACTIVITY_TYPE_VARIANTS[activity.type],
    authorName: activity.authorName,
    authorTypeText: CUSTOMER_AUDIT_ACTOR_TYPE_LABELS[activity.authorType],
    createdAtText: formatDateTime(activity.createdAt),
    body: activity.body,
    canEdit: canEditActivity(activity.authorType),
    updateToken: toActivityUpdateToken(activity),
  };
}

/**
 * Maps one page of the feed, keeping the server's order (newest first).
 *
 * @param activities - the rows of the current page.
 * @returns the view models in the same order.
 */
export function toCustomerActivityViewModels(
  activities: readonly Activity[],
): CustomerActivityViewModels {
  return activities.map(toCustomerActivityViewModel);
}
