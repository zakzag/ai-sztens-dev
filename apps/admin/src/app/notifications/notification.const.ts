import type { NotificationLevel, NotificationSource } from '@callback/notifications';

/**
 * Constants of the admin notification capture (AIS-84).
 *
 * Copy and formatting only — the *policy* (which failure becomes a toast) lives
 * in `notification-events.logic.ts`, so every number and every word is
 * reviewable in one place.
 */

/** Separator between the request line and its outcome, e.g. `GET /api-keys — 200`. */
export const HTTP_EVENT_SEPARATOR = ' — ';

/** Stands in for a status code when no response arrived at all. */
export const HTTP_NETWORK_ERROR_LABEL = 'hálózati hiba';

/** Unit suffix of the duration recorded in the entry's detail. */
export const HTTP_EVENT_TIMING_SUFFIX = ' ms';

/** Separator of the `status=… · code=…` detail segments. */
export const NOTIFICATION_DETAIL_SEPARATOR = ' · ';

/** Upper bound of a serialised query/mutation key in the detail field. */
export const NOTIFICATION_KEY_LENGTH_LIMIT = 120;

/** Placeholder for a key that cannot be serialised (circular reference). */
export const NOTIFICATION_KEY_UNSERIALIZABLE = '<nem sorosítható>';

/** Detail label of a query key. */
export const QUERY_KEY_DETAIL_LABEL = 'queryKey';

/** Detail label of a mutation key. */
export const MUTATION_KEY_DETAIL_LABEL = 'mutationKey';

/** Meta field a mutation may carry the success copy in. */
export const SUCCESS_MESSAGE_META_KEY = 'successMessage';

/** Level of a successful HTTP attempt: visible in the log, never a toast. */
export const HTTP_EVENT_SUCCESS_LEVEL: NotificationLevel = 'system';

/** Source of every entry produced by the transport. */
export const HTTP_EVENT_SOURCE: NotificationSource = 'api';
