import {
  NOTIFICATION_STORAGE_KEY,
  NOTIFICATION_STORAGE_MAX_ENTRIES,
} from './notification.const.js';
import type { NotificationEntry } from './notification.interface.js';
import { trimEntries } from './notification.logic.js';
import {
  fromPersistedEnvelope,
  toPersistedEnvelope,
} from './notification.storage.logic.js';
import type {
  NotificationStorage,
  NotificationStorageOptions,
  NotificationWriteCancel,
  NotificationWriteScheduler,
  StorageLike,
} from './notification.storage.interface.js';

/**
 * Default write coalescer: one flush per microtask.
 *
 * A microtask is the strongest coalescing this package can do on its own — the
 * `tsconfig` enables `lib: ["ES2022"]` only, so `requestAnimationFrame` is not
 * available here (AIS-80 decision D6). Five `save` calls in one synchronous block
 * therefore produce exactly one `setItem`. AIS-83 replaces this with an
 * `requestAnimationFrame`-based scheduler, which is also what the ticket asks for.
 *
 * @param flush - writes the pending payload.
 * @returns a cancel function; the queued microtask itself cannot be cancelled, so
 *   cancellation is a flag checked before the flush runs.
 */
const scheduleOnMicrotask: NotificationWriteScheduler = (flush) => {
  let cancelled = false;

  void Promise.resolve().then(() => {
    if (!cancelled) {
      flush();
    }
  });

  return () => {
    cancelled = true;
  };
};

/**
 * Creates the `sessionStorage` mirror of the notification log.
 *
 * The adapter is the only part of the package that knows a storage exists, and it
 * knows it exclusively through the injected {@link StorageLike} (AIS-80 decision
 * D10). It never throws and never reports an error: a full, disabled or throwing
 * storage silently degrades to memory-only, because losing the log is acceptable
 * while breaking the app is not (D13).
 *
 * Not bound to a store: the owning app reads {@link NotificationStorage.load} once,
 * seeds `createNotificationStore({ initialEntries })` with it, then forwards each
 * `entries` snapshot to {@link NotificationStorage.save} and calls
 * {@link NotificationStorage.flush} on `pagehide` (AIS-83).
 *
 * @param options - injected storage, key, cap and write scheduler.
 * @returns the adapter; with no storage it accepts every call and does nothing.
 */
export function createNotificationStorage(options: NotificationStorageOptions = {}): NotificationStorage {
  const storage: StorageLike | null = options.storage ?? null;
  const key = options.key ?? NOTIFICATION_STORAGE_KEY;
  const cap = options.cap ?? NOTIFICATION_STORAGE_MAX_ENTRIES;
  const schedule = options.schedule ?? scheduleOnMicrotask;

  let cancelPending: NotificationWriteCancel | null = null;
  let pendingPayload: string | null = null;
  let lastWrittenPayload: string | null = null;

  function cancelPendingWrite(): void {
    cancelPending?.();
    cancelPending = null;
  }

  function write(payload: string): void {
    if (storage === null) {
      return;
    }

    try {
      storage.setItem(key, payload);
      lastWrittenPayload = payload;
    } catch {
      // Quota exceeded, storage disabled (private mode) or a hostile extension:
      // the mirror degrades to memory-only. The payload is deliberately not
      // remembered as written, so the next save retries instead of skipping a
      // state that never reached the browser (AIS-80 decision D10).
    }
  }

  function flush(): void {
    const payload = pendingPayload;

    cancelPendingWrite();
    pendingPayload = null;

    if (payload === null) {
      return;
    }

    write(payload);
  }

  function removeKey(): void {
    if (storage === null) {
      return;
    }

    try {
      storage.removeItem(key);
    } catch {
      // Same degradation as a failed write: the key survives, the app does not
      // care. Documented rather than swallowed silently (AIS-80 decision D10).
    }
  }

  function load(): readonly NotificationEntry[] {
    if (storage === null) {
      return [];
    }

    let raw: string | null;

    try {
      raw = storage.getItem(key);
    } catch {
      // An unreadable storage is treated as empty. `removeItem` is not called: a
      // storage that throws on read would throw on remove as well.
      return [];
    }

    const result = fromPersistedEnvelope(raw);

    if (!result.ok) {
      if (result.reason !== 'missing') {
        removeKey();
      }

      return [];
    }

    const entries = trimEntries(result.entries, cap);

    // The restored payload becomes the write baseline: the first store notification
    // reports the same entries, and that must not re-write what is already stored.
    lastWrittenPayload = JSON.stringify(toPersistedEnvelope(entries, cap));

    return entries;
  }

  function save(entries: readonly NotificationEntry[]): void {
    if (storage === null) {
      return;
    }

    const payload = JSON.stringify(toPersistedEnvelope(entries, cap));

    if (payload === lastWrittenPayload) {
      // Nothing changed since the last successful write (or the restore): a toast
      // dismissal or an already-persisted snapshot must not burn an `setItem`.
      cancelPendingWrite();
      pendingPayload = null;

      return;
    }

    pendingPayload = payload;

    if (cancelPending !== null) {
      // A tick is already scheduled and will pick up the latest payload.
      return;
    }

    cancelPending = schedule(flush);
  }

  function clear(): void {
    // Cancelling first is what makes "Törlés" stick: a queued flush would otherwise
    // re-create the key immediately after the removal (AIS-80 decision D8).
    cancelPendingWrite();
    pendingPayload = null;
    lastWrittenPayload = null;

    removeKey();
  }

  return { load, save, flush, clear };
}
