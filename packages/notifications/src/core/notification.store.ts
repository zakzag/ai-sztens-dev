import {
  EMPTY_NOTIFICATION_STATE,
  NOTIFICATION_DEDUPE_WINDOW_MS,
  NOTIFICATION_MAX_ENTRIES,
  NOTIFICATION_MAX_VISIBLE_TOASTS,
} from './notification.const.js';
import type {
  EmitNotificationInput,
  NotificationEntry,
  NotificationListener,
  NotificationListenerErrorHandler,
  NotificationState,
  NotificationStore,
  NotificationStoreOptions,
} from './notification.interface.js';
import {
  bumpEntry,
  createNotificationId,
  findDuplicate,
  markEntriesRead,
  toRedactedDetail,
  trimEntries,
  trimToastIds,
} from './notification.logic.js';

/**
 * Minimal shape of a console, declared here so the package stays free of the
 * DOM and Node type libraries (only `lib: ES2022` is enabled).
 */
interface ConsoleLike {
  readonly error: (...args: readonly unknown[]) => void;
}

/**
 * Default subscriber-error handler.
 *
 * One throwing subscriber must not silence the others (AIS-79 decision D12), and
 * the failure must not disappear silently either: it is logged here and can be
 * replaced through `NotificationStoreOptions.onListenerError`.
 */
const logListenerError: NotificationListenerErrorHandler = (error: unknown): void => {
  const consoleLike = (globalThis as { readonly console?: ConsoleLike }).console;
  consoleLike?.error('[notifications] subscriber failed', error);
};

/**
 * Builds the initial state of a store.
 *
 * Only `entries` are seeded: `toasts` always starts empty so a reload never
 * resurrects an already expired toast (AIS-79 decision D10).
 *
 * @param initialEntries - entries restored by the caller, newest first.
 * @param maxEntries - ring-buffer size.
 * @returns the empty singleton when nothing was restored.
 */
function createInitialState(
  initialEntries: readonly NotificationEntry[],
  maxEntries: number,
): NotificationState {
  if (initialEntries.length === 0) {
    return EMPTY_NOTIFICATION_STATE;
  }

  return { entries: trimEntries(initialEntries, maxEntries), toasts: [] };
}

/**
 * Creates a notification/log store instance.
 *
 * A factory rather than a package-level singleton (AIS-79 decision in the base
 * plan): the owning application decides the lifetime, so two apps — or two tests
 * — never share state. The store holds no React, DOM or storage reference; a UI
 * subscribes through {@link NotificationStore.subscribe} and reads
 * {@link NotificationStore.getSnapshot}.
 *
 * @param options - injected clock, caps, dedupe window and restored entries.
 * @returns a store whose snapshot is referentially stable while nothing changes.
 */
export function createNotificationStore(options: NotificationStoreOptions = {}): NotificationStore {
  const now = options.now ?? Date.now;
  const maxEntries = options.maxEntries ?? NOTIFICATION_MAX_ENTRIES;
  const maxVisibleToasts = options.maxVisibleToasts ?? NOTIFICATION_MAX_VISIBLE_TOASTS;
  const dedupeWindowMs = options.dedupeWindowMs ?? NOTIFICATION_DEDUPE_WINDOW_MS;
  const onListenerError = options.onListenerError ?? logListenerError;

  const listeners = new Set<NotificationListener>();
  let sequence = 0;
  let state = createInitialState(options.initialEntries ?? [], maxEntries);

  function notify(): void {
    // Iterate a copy: a listener may unsubscribe itself while being called.
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        onListenerError(error);
      }
    }
  }

  function commit(next: NotificationState): void {
    if (next === state) {
      return;
    }

    state = next;
    notify();
  }

  function createEntry(input: EmitNotificationInput, createdAt: number): NotificationEntry {
    sequence += 1;

    return {
      id: createNotificationId(createdAt, sequence),
      level: input.level,
      message: input.message,
      detail: toRedactedDetail(input.detail),
      source: input.source,
      createdAt,
      read: false,
      toast: input.toast ?? input.level !== 'system',
      repeatCount: 1,
    };
  }

  function emit(input: EmitNotificationInput): NotificationEntry {
    const createdAt = now();
    const duplicate = findDuplicate(state.entries, input, createdAt, dedupeWindowMs);
    const entry = duplicate === undefined ? createEntry(input, createdAt) : bumpEntry(duplicate, createdAt);

    const entries = trimEntries(
      [entry, ...state.entries.filter((existing) => existing.id !== entry.id)],
      maxEntries,
    );
    const otherToastIds = state.toasts.filter((toastId) => toastId !== entry.id);
    const toasts = trimToastIds(
      entry.toast ? [entry.id, ...otherToastIds] : otherToastIds,
      maxVisibleToasts,
    );

    commit({ entries, toasts });

    return entry;
  }

  function dismiss(id: string): void {
    if (!state.toasts.includes(id)) {
      return;
    }

    commit({
      entries: state.entries,
      toasts: state.toasts.filter((toastId) => toastId !== id),
    });
  }

  function markAllRead(): void {
    const entries = markEntriesRead(state.entries);

    if (entries === state.entries) {
      return;
    }

    commit({ entries, toasts: state.toasts });
  }

  function clear(): void {
    commit(EMPTY_NOTIFICATION_STATE);
  }

  function subscribe(listener: NotificationListener): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot(): NotificationState {
    return state;
  }

  function getServerSnapshot(): NotificationState {
    return EMPTY_NOTIFICATION_STATE;
  }

  return {
    emit,
    dismiss,
    markAllRead,
    clear,
    subscribe,
    getSnapshot,
    getServerSnapshot,
  };
}
