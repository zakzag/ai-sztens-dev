import type { NotificationEntry } from '../../../src/core/notification.interface.js';
import type { NotificationStorage } from '../../../src/core/notification.storage.interface.js';

/**
 * A {@link NotificationStorage} that records how it was used.
 *
 * Counters instead of spies: the tests assert observable behaviour ("the mirror
 * was read once", "the mirror was flushed on pagehide") and never an internal
 * call order.
 */
export interface RecordingStorage extends NotificationStorage {
  /** How many times `load()` ran. */
  readonly loadCount: () => number;
  /** How many times `save()` received entries. */
  readonly saveCount: () => number;
  /** How many times `flush()` ran. */
  readonly flushCount: () => number;
  /** How many times `clear()` ran. */
  readonly clearCount: () => number;
  /** The entries of the last `save()`, or `null` before the first one. */
  readonly lastSaved: () => readonly NotificationEntry[] | null;
}

/**
 * Builds the recording mirror.
 *
 * @param restored - entries `load()` should return; defaults to none.
 * @returns the mirror and its counters.
 */
export function createRecordingStorage(
  restored: readonly NotificationEntry[] = [],
): RecordingStorage {
  let loads = 0;
  let saves = 0;
  let flushes = 0;
  let clears = 0;
  let lastSaved: readonly NotificationEntry[] | null = null;

  return {
    load: () => {
      loads += 1;

      return restored;
    },
    save: (entries) => {
      saves += 1;
      lastSaved = entries;
    },
    flush: () => {
      flushes += 1;
    },
    clear: () => {
      clears += 1;
      lastSaved = null;
    },
    loadCount: () => loads,
    saveCount: () => saves,
    flushCount: () => flushes,
    clearCount: () => clears,
    lastSaved: () => lastSaved,
  };
}
