import type {
  NotificationEntry,
  NotificationLevel,
  NotificationStore,
} from '../core/notification.interface.js';
import { DEFAULT_NOTIFIER_SOURCE } from './notification-react.const.js';
import { useNotificationContext } from './notification.context.js';
import type { Notifier, NotifyOptions } from './notification-react.interface.js';

/**
 * Builds one shortcut of the facade for a fixed level.
 *
 * Kept private: the five shortcuts differ only by their level, so the shape of an
 * emit exists once (DRY) and a new shortcut is one line, not a new branch.
 *
 * @param store - store the emit goes to.
 * @param level - severity the shortcut files the entry under.
 * @returns a `notify.<level>` function.
 */
function createLevelShortcut(
  store: NotificationStore,
  level: NotificationLevel,
): (message: string, options?: NotifyOptions) => NotificationEntry {
  return (message: string, options: NotifyOptions = {}): NotificationEntry =>
    store.emit({
      level,
      message,
      source: options.source ?? DEFAULT_NOTIFIER_SOURCE,
      detail: options.detail,
      // `system` is log-only noise unless the caller explicitly asks for a toast.
      toast: options.toast ?? level !== 'system',
    });
}

/**
 * Binds the `notify` facade to a store, without React.
 *
 * A service, a plain module or a test can emit into any store instance; nothing
 * here touches a provider, a context or the DOM (AIS-83 decision D10).
 *
 * @param store - the store the shortcuts emit into.
 * @returns the five shortcuts (`success`, `error`, `warning`, `info`, `system`).
 */
export function createNotifier(store: NotificationStore): Notifier {
  return {
    success: createLevelShortcut(store, 'success'),
    error: createLevelShortcut(store, 'error'),
    warning: createLevelShortcut(store, 'warning'),
    info: createLevelShortcut(store, 'info'),
    system: createLevelShortcut(store, 'system'),
  };
}

/**
 * The `notify` facade of the surrounding provider.
 *
 * The notifier is memoised by the provider, so it is safe to put in a dependency
 * array; every shortcut delegates to the same store the hooks read from.
 *
 * @returns the provider-bound facade.
 */
export function useNotifier(): Notifier {
  return useNotificationContext('useNotifier').notifier;
}
