import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { NOTIFICATION_EVENT_DEFAULTS } from '../core/notification-event.const.js';
import type { NotificationStore } from '../core/notification.interface.js';
import { createNotificationStore } from '../core/notification.store.js';
import type { NotificationStorage, StorageLike } from '../core/notification.storage.interface.js';
import { createNotificationStorage } from '../core/notification.storage.js';
import { createNotifier } from './notification.facade.js';
import { RUNTIME_ERROR_MESSAGE } from './notification-react.const.js';
import { MissingNotificationProviderError } from './notification-react.errors.js';
import {
  createRafScheduler,
  formatDefaultTimestamp,
  toRuntimeDetail,
} from './notification-react.logic.js';
import type {
  NotificationContextValue,
  NotificationProviderProps,
} from './notification-react.interface.js';

/**
 * The provider payload.
 *
 * `null` means "no provider above us", which every hook turns into a typed
 * {@link MissingNotificationProviderError} instead of a silent empty state.
 */
const NotificationContext = createContext<NotificationContextValue | null>(null);

/**
 * The global object, or `null` during SSR.
 *
 * Every DOM access in this file goes through this one function, so the package
 * stays importable in Node (a bare `window` reference would throw at import time
 * in a test runner with `environment: 'node'`).
 *
 * @returns the window in a browser, `null` anywhere else.
 */
function getWindow(): Window | null {
  return typeof window === 'undefined' ? null : window;
}

/**
 * Reads `sessionStorage`, tolerating a blocked or absent one.
 *
 * A storage that throws on property access (blocked cookies, private mode) must
 * degrade to memory-only, never break the render (AIS-80 D13).
 *
 * @returns the browser storage, or `null` when it cannot be reached.
 */
function readSessionStorage(): StorageLike | null {
  const win = getWindow();

  if (win === null) {
    return null;
  }

  try {
    return win.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Owns the store instance, the `sessionStorage` mirror and the global listeners.
 *
 * Everything an app needs to mount once:
 *
 * - the store **and** the mirror are created in `useState` lazy initialisers, so
 *   `storage.load()` runs exactly once, synchronously, and the first paint already
 *   shows the restored log — no loading flash, no effect-based flicker (AIS-83 D2);
 * - one subscription forwards every `entries` snapshot to the mirror, `pagehide`
 *   flushes whatever is pending, and the cleanup unsubscribes, removes the
 *   listener and flushes what is still queued;
 * - `window` `error` and `unhandledrejection` become `runtime`/`error` entries
 *   (base plan §4.4), with the stack only when `includeDetails` allows it.
 *
 * @param props - see {@link NotificationProviderProps}; every collaborator can be
 *   injected, which is what makes the binding testable without a browser.
 * @returns the context provider wrapping the app.
 */
export function NotificationProvider({
  children,
  store: injectedStore,
  storage: injectedStorage,
  includeDetails = false,
  formatTimestamp = formatDefaultTimestamp,
  scheduleWrite,
}: NotificationProviderProps): ReactElement {
  const [storage] = useState<NotificationStorage>(
    () =>
      injectedStorage ??
      createNotificationStorage({
        storage: readSessionStorage(),
        schedule: scheduleWrite ?? createRafScheduler(getWindow()),
      }),
  );

  const [store] = useState<NotificationStore>(
    () => injectedStore ?? createNotificationStore({ initialEntries: storage.load() }),
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      storage.save(store.getSnapshot().entries);
    });
    const win = getWindow();
    const flush = (): void => storage.flush();

    win?.addEventListener('pagehide', flush);

    return () => {
      unsubscribe();
      win?.removeEventListener('pagehide', flush);
      // Nothing may stay queued after unmount: the mirror would miss the last
      // entries, because no later tick is guaranteed to run.
      storage.flush();
    };
  }, [store, storage]);

  useEffect(() => {
    const win = getWindow();

    if (win === null) {
      return undefined;
    }

    const defaults = NOTIFICATION_EVENT_DEFAULTS['runtime.error'];

    const handleError = (event: ErrorEvent): void => {
      store.emit({
        level: defaults.level,
        source: defaults.source,
        toast: defaults.toast,
        message: RUNTIME_ERROR_MESSAGE,
        detail: toRuntimeDetail(event.error, includeDetails),
      });
    };

    const handleRejection = (event: PromiseRejectionEvent): void => {
      store.emit({
        level: defaults.level,
        source: defaults.source,
        toast: defaults.toast,
        message: RUNTIME_ERROR_MESSAGE,
        detail: toRuntimeDetail(event.reason, includeDetails),
      });
    };

    win.addEventListener('error', handleError);
    win.addEventListener('unhandledrejection', handleRejection);

    return () => {
      win.removeEventListener('error', handleError);
      win.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [store, includeDetails]);

  const notifier = useMemo(() => createNotifier(store), [store]);
  const value = useMemo<NotificationContextValue>(
    () => ({ store, storage, notifier, includeDetails, formatTimestamp }),
    [store, storage, notifier, includeDetails, formatTimestamp],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

/**
 * Reads the provider payload or fails loudly.
 *
 * Internal to the package: a hook names itself, so the error says which call was
 * missing its provider instead of "cannot read property of null".
 *
 * @param hookName - the hook asking for the context.
 * @returns the provider payload.
 * @throws MissingNotificationProviderError when the hook is used outside the provider.
 */
export function useNotificationContext(hookName: string): NotificationContextValue {
  const value = useContext(NotificationContext);

  if (value === null) {
    throw new MissingNotificationProviderError(hookName);
  }

  return value;
}
