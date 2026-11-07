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

/** Meta field a query or mutation may carry its domain operation name in. */
export const OPERATION_META_KEY = 'operation';

/** Level of a successful HTTP attempt: visible in the log, never a toast. */
export const HTTP_EVENT_SUCCESS_LEVEL: NotificationLevel = 'system';

/** Source of every entry produced by the transport. */
export const HTTP_EVENT_SOURCE: NotificationSource = 'api';

/**
 * Detail-row labels of the expandable log entry (AIS-152).
 *
 * One constant per label because the labels are part of the log's contract: the
 * row is rendered generically, so a typo here would silently rename a row in the
 * UI. Technical identifiers stay English (they mirror the payload field names the
 * reader will look up in the server log), and the copy the user reads comes from
 * `message`/`detail`, not from these labels.
 *
 * `repeatCount` and `createdAt` are **not** listed: the store owns both and the
 * row renders them from the entry, so a label would be an unused export.
 */

/** HTTP verb of the attempt. */
export const DETAIL_LABEL_METHOD = 'method';

/** Request path without the query. */
export const DETAIL_LABEL_PATH = 'path';

/** Request query string, without the leading `?`. */
export const DETAIL_LABEL_QUERY = 'query';

/** HTTP status, or the network-failure label when there was no response. */
export const DETAIL_LABEL_STATUS = 'status';

/** Wall-clock duration of the attempt. */
export const DETAIL_LABEL_DURATION = 'duration';

/** `success` or `error`, exactly as the transport reported it. */
export const DETAIL_LABEL_OUTCOME = 'outcome';

/** Correlation id shared with the server log. */
export const DETAIL_LABEL_REQUEST_ID = 'requestId';

/** Server timestamp of the response (`meta.timestamp`). */
export const DETAIL_LABEL_RESPONSE_TIMESTAMP = 'responseTimestamp';

/** Total row count of a paginated response. */
export const DETAIL_LABEL_TOTAL_ITEMS = 'totalItems';

/** Masked prefix of the request body. */
export const DETAIL_LABEL_BODY_PREVIEW = 'body';

/** Domain operation the entry belongs to. */
export const DETAIL_LABEL_OPERATION = 'operation';

/** Capture channel of the entry (`api`, `form`, …). */
export const DETAIL_LABEL_SOURCE = 'source';

/** Stable machine code of a failure. */
export const DETAIL_LABEL_CODE = 'code';

/** Fallback label of a field issue without a path. */
export const DETAIL_LABEL_ISSUES = 'issues';

/** Request URL of the failure, as the transport called it. */
export const DETAIL_LABEL_URL = 'url';

/** Tier that renders the failure (`field`, `banner`, `page`). */
export const DETAIL_LABEL_SURFACE = 'surface';

/** Name of the thrown error. */
export const DETAIL_LABEL_ERROR_NAME = 'error';

/** Message of the thrown error. */
export const DETAIL_LABEL_MESSAGE = 'message';

/** Stack trace of a runtime crash (development only). */
export const DETAIL_LABEL_STACK = 'stack';

/** React's component trace of a runtime crash. */
export const DETAIL_LABEL_COMPONENT_STACK = 'componentStack';
