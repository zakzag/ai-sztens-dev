import type { StorageLike } from '../core/notification.storage.interface.js';
import { serializeDrawerWidth } from './notification-react.logic.js';
import { LOG_DRAWER_WIDTH_STORAGE_KEY } from './notification-react.const.js';
import type {
  LogDrawerWidthStorage,
  LogDrawerWidthStorageOptions,
} from './notification-react.interface.js';

/**
 * Creates the `localStorage` cell that remembers the log drawer's width.
 *
 * The adapter is the only part of the package that knows a width is persisted,
 * and it knows it exclusively through the injected {@link StorageLike}
 * (AIS-150 D2, following AIS-80 D10). It never throws and never reports an
 * error: a disabled, full or hostile storage silently degrades to "the panel
 * opens with the default width", because losing a width preference is
 * acceptable while breaking the log is not (AIS-80 D13, AIS-150 D8).
 *
 * Not bound to a controller: `useLogDrawer` reads {@link LogDrawerWidthStorage.load}
 * once in a lazy `useState` initialiser and writes through
 * {@link LogDrawerWidthStorage.save} when a resize gesture ends.
 *
 * @param options - injected storage and key; both default to production values.
 * @returns the adapter; with no storage every call is a no-op.
 */
export function createLogDrawerWidthStorage(
  options: LogDrawerWidthStorageOptions = {},
): LogDrawerWidthStorage {
  const storage: StorageLike | null = options.storage ?? null;
  const key = options.key ?? LOG_DRAWER_WIDTH_STORAGE_KEY;

  function load(): string | null {
    if (storage === null) {
      return null;
    }

    try {
      return storage.getItem(key);
    } catch {
      // A storage that throws on read (blocked cookies, private mode) is treated
      // as empty; `removeItem` is deliberately not called, because a storage
      // that throws on read would throw there as well (AIS-150 D8).
      return null;
    }
  }

  function save(width: number): void {
    if (storage === null) {
      return;
    }

    try {
      storage.setItem(key, serializeDrawerWidth(width));
    } catch {
      // Quota exceeded or storage disabled: the preference degrades to
      // per-session only. Documented rather than swallowed silently (D8).
    }
  }

  return { load, save };
}
