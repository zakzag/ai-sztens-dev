/**
 * Public API of `@callback/notifications` (core).
 *
 * Framework-independent: no React, no DOM, no storage. Explicit exports only —
 * no `export *` — so the public surface is reviewable at a glance.
 */
export {
  EMPTY_NOTIFICATION_STATE,
  NOTIFICATION_DEDUPE_WINDOW_MS,
  NOTIFICATION_LEVELS,
  NOTIFICATION_MAX_ENTRIES,
  NOTIFICATION_MAX_VISIBLE_TOASTS,
  NOTIFICATION_REDACTED_PLACEHOLDER,
  NOTIFICATION_SENSITIVE_KEY_PATTERN,
  NOTIFICATION_SOURCES,
  NOTIFICATION_UNSERIALIZABLE_DETAIL,
} from './core/notification.const.js';
export { NOTIFICATION_EVENT_DEFAULTS, NOTIFICATION_EVENT_KINDS } from './core/notification-event.const.js';
export {
  bumpEntry,
  createNotificationId,
  findDuplicate,
  markEntriesRead,
  redactRecord,
  redactValue,
  toRedactedDetail,
  trimEntries,
  trimToastIds,
} from './core/notification.logic.js';
export { createNotificationStore } from './core/notification.store.js';
export type {
  EmitNotificationInput,
  NotificationEntry,
  NotificationEventDefaults,
  NotificationEventKind,
  NotificationIdentity,
  NotificationLevel,
  NotificationListener,
  NotificationListenerErrorHandler,
  NotificationSource,
  NotificationState,
  NotificationStore,
  NotificationStoreOptions,
} from './core/notification.interface.js';
