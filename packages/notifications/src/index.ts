/**
 * Public API of `@callback/notifications` (core).
 *
 * Framework-independent: no React, no DOM, no storage. Explicit exports only —
 * no `export *` — so the public surface is reviewable at a glance.
 */
export {
  EMPTY_NOTIFICATION_STATE,
  NOTIFICATION_DEDUPE_WINDOW_MS,
  NOTIFICATION_DETAILS_INVALID_PLACEHOLDER,
  NOTIFICATION_DETAIL_LABEL_MAX_LENGTH,
  NOTIFICATION_DETAIL_MAX_FIELDS,
  NOTIFICATION_DETAIL_TRUNCATION_SUFFIX,
  NOTIFICATION_DETAIL_VALUE_MAX_LENGTH,
  NOTIFICATION_LEVELS,
  NOTIFICATION_MAX_ENTRIES,
  NOTIFICATION_MAX_VISIBLE_TOASTS,
  NOTIFICATION_REDACTED_PLACEHOLDER,
  NOTIFICATION_SENSITIVE_KEY_PATTERN,
  NOTIFICATION_SOURCES,
  NOTIFICATION_STORAGE_KEY,
  NOTIFICATION_STORAGE_MAX_ENTRIES,
  NOTIFICATION_STORAGE_VERSION,
  NOTIFICATION_UNSERIALIZABLE_DETAIL,
} from './core/notification.const.js';
export { NOTIFICATION_EVENT_DEFAULTS, NOTIFICATION_EVENT_KINDS } from './core/notification-event.const.js';
export {
  bumpEntry,
  clampDetailFields,
  createNotificationId,
  findDuplicate,
  markEntriesRead,
  redactRecord,
  redactValue,
  toDetailFields,
  toRedactedDetail,
  trimEntries,
  trimToastIds,
} from './core/notification.logic.js';
export { createNotificationStore } from './core/notification.store.js';
export { createNotificationStorage } from './core/notification.storage.js';
export {
  fromPersistedEnvelope,
  isPersistedEntry,
  toPersistedEnvelope,
} from './core/notification.storage.logic.js';
export type {
  EmitNotificationInput,
  NotificationDetailField,
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
export type {
  NotificationStorage,
  NotificationStorageOptions,
  NotificationWriteCancel,
  NotificationWriteScheduler,
  PersistedEnvelopeAccepted,
  PersistedEnvelopeReadResult,
  PersistedEnvelopeRejected,
  PersistedEnvelopeRejection,
  PersistedEnvelopeVersion,
  PersistedNotificationLog,
  StorageLike,
} from './core/notification.storage.interface.js';
