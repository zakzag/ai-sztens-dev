/**
 * Read and writes of one customer's activity feed (AIS-181).
 *
 * Four **adapters**, not implementations: the pending flag, the failure
 * projection and the invalidation-after-success all live in the generic
 * [`features/api`](../api) hooks, so this file keeps only what is specific to the
 * resource — the service call, the bound ids and the query-key prefix.
 *
 * Decisions worth keeping:
 *
 * - the **author** is never part of a body: `createActivitySchema` is `.strict()`
 *   and the server stamps `author_*` from the request context, so a client cannot
 *   write an entry in someone else's name;
 * - every write invalidates the whole `customers` prefix, because the feed, the
 *   detail (`lastActivityAt` is derived from the activities) and the list row all
 *   become stale at once — the single rule of AIS-181 `D12`;
 * - **no** `meta.successMessage` on the two form writes: the form's notify port
 *   owns that copy (`New-Admin-Page.md` step 15 / AIS-136). The soft delete has
 *   no form, so it carries its own message.
 */

import type { Activity, ActivityListQuery, CreateActivityInput, UpdateActivityInput } from '@callback/shared';
import { useApiList } from '../api/use-api-list.js';
import { useApiMutation } from '../api/use-api-mutation.js';
import { customersService } from '../../services/api-client.js';
import {
  CUSTOMER_ACTIVITIES_QUERY_KEYS,
  CUSTOMERS_ACTIVITY_REMOVE_SUCCESS_MESSAGE,
  CUSTOMERS_QUERY_KEYS,
  EMPTY_ACTIVITY_LIST,
} from './customers.const.js';
import type {
  CustomerActivitiesResult,
  UseCreateActivityResult,
  UseRemoveActivityResult,
  UseUpdateActivityResult,
} from './customers.interface.js';

/**
 * Reads one page of a customer's live activity feed.
 *
 * The query is part of the key, so a page change produces a new cache entry
 * instead of refetching under the old one; rows stay in the cache and are never
 * copied into a store.
 *
 * @param customerId - the customer's uuid, i.e. the detail route's `:id`.
 * @param query - the validated feed query (`page`, `limit`, `order` from the URL).
 * @returns the rows, the envelope `meta` and the four UI states.
 */
export function useCustomerActivities(
  customerId: string,
  query: ActivityListQuery,
): CustomerActivitiesResult {
  const { data: activities, ...listState } = useApiList<readonly Activity[]>({
    queryKey: CUSTOMER_ACTIVITIES_QUERY_KEYS.list(customerId, query),
    queryFn: () => customersService.listActivities(customerId, query),
    emptyData: EMPTY_ACTIVITY_LIST,
    enabled: customerId !== '',
  });

  return { activities, ...listState };
}

/**
 * Records one entry in the caller's name.
 *
 * @param customerId - the customer's uuid.
 * @returns the submit function, its pending flag and the mapped failure.
 */
export function useCreateActivityMutation(
  customerId: string,
): UseCreateActivityResult {
  const mutation = useApiMutation<Activity, CreateActivityInput>({
    mutationFn: (input: CreateActivityInput) =>
      customersService.createActivity(customerId, input),
    mutationKey: ['customers', 'activity', 'create'],
    invalidateKeys: [CUSTOMERS_QUERY_KEYS.all],
  });

  return {
    createActivity: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
  };
}

/**
 * Patches the body of one entry.
 *
 * The body always carries the concurrency token, which the contract defines as
 * the **last write instant** (`updatedAt ?? createdAt`) — sending `updatedAt`
 * alone would reject the first edit of every entry, because that column is
 * `null` until something was edited.
 *
 * @param customerId - the customer's uuid.
 * @param activityId - the entry's uuid.
 * @returns the submit function, its pending flag and the mapped failure.
 */
export function useUpdateActivityMutation(
  customerId: string,
  activityId: string,
): UseUpdateActivityResult {
  const mutation = useApiMutation<Activity, UpdateActivityInput>({
    mutationFn: (input: UpdateActivityInput) =>
      customersService.updateActivity(customerId, activityId, input),
    mutationKey: ['customers', 'activity', 'update'],
    invalidateKeys: [CUSTOMERS_QUERY_KEYS.all],
  });

  return {
    updateActivity: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
  };
}

/**
 * Soft-deletes one entry.
 *
 * The endpoint answers `200` with `data: null`; the row disappears from the feed
 * on the refetch that the invalidation schedules, and the change is recorded as
 * a `soft_delete` row of the audit log by the server.
 *
 * @param customerId - the customer's uuid.
 * @param activityId - the entry's uuid.
 * @returns the trigger, its pending flag and the mapped failure.
 */
export function useRemoveActivityMutation(
  customerId: string,
  activityId: string,
): UseRemoveActivityResult {
  const mutation = useApiMutation<null, void>({
    mutationFn: () => customersService.removeActivity(customerId, activityId),
    mutationKey: ['customers', 'activity', 'remove'],
    invalidateKeys: [CUSTOMERS_QUERY_KEYS.all],
    meta: { successMessage: CUSTOMERS_ACTIVITY_REMOVE_SUCCESS_MESSAGE },
  });

  return {
    removeActivity: () => mutation.mutateAsync(),
    isPending: mutation.isPending,
    error: mutation.error,
    errorMessage: mutation.errorMessage,
    errorSurface: mutation.errorSurface,
  };
}
