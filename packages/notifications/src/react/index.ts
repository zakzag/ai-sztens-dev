/**
 * Public API of `@callback/notifications/react`.
 *
 * The React binding layer: one provider + one host pair, and the hooks a page
 * uses to emit or to build its own host. Imported through the `./react` subpath,
 * so the framework-free core (`@callback/notifications`) never pulls React in
 * (AIS-83 decision D1).
 *
 * Explicit exports only — no `export *` — so the public surface is reviewable at
 * a glance.
 */
export { NotificationProvider } from './notification.context.js';
export { NotificationHost } from './NotificationHost.js';
export { createNotifier, useNotifier } from './notification.facade.js';
export {
  useLogDrawer,
  useLogEntries,
  useToastTimers,
  useToasts,
} from './use-notifications.js';
export { MissingNotificationProviderError } from './notification-react.errors.js';
export {
  DEFAULT_LOCALE,
  DEFAULT_NOTIFIER_SOURCE,
  LOG_INITIAL_PAGE,
  LOG_PAGE_STEP,
  RUNTIME_ERROR_MESSAGE,
  TOAST_TTL_MS_BY_LEVEL,
  UNKNOWN_ERROR_NAME,
} from './notification-react.const.js';
export {
  countUnseen,
  createRafScheduler,
  filterEntries,
  formatDefaultTimestamp,
  hasMoreEntries,
  resolveToastTtl,
  sliceWindow,
  toRuntimeDetail,
  toToastItems,
} from './notification-react.logic.js';
export type {
  AnimationFrameScope,
  LogDrawerController,
  NotificationContextValue,
  NotificationProviderProps,
  NotificationToastItem,
  Notifier,
  NotifyOptions,
  ToastTimerControls,
  ToastTtl,
  ToastTtlByLevel,
} from './notification-react.interface.js';
