import type { LogDrawerWidthStorage } from '../../../src/react/notification-react.interface.js';

/**
 * A {@link LogDrawerWidthStorage} that records how it was used.
 *
 * Counters instead of spies, for the same reason as `createRecordingStorage`:
 * the tests assert observable behaviour ("the width was persisted once") and
 * never an internal call order.
 */
export interface RecordingWidthStorage extends LogDrawerWidthStorage {
  /** How many times `load()` ran. */
  readonly loadCount: () => number;
  /** How many times `save()` ran. */
  readonly saveCount: () => number;
  /** The width of the last `save()`, or `null` before the first one. */
  readonly lastSaved: () => number | null;
  /** Every width `save()` received, in call order. */
  readonly savedWidths: () => readonly number[];
}

/**
 * Builds the recording width storage.
 *
 * @param stored - raw payload `load()` should return; defaults to nothing
 *   stored, which is the first-visit case.
 * @returns the storage and its counters.
 */
export function createRecordingWidthStorage(
  stored: string | null = null,
): RecordingWidthStorage {
  let loads = 0;
  let saves = 0;
  const widths: number[] = [];

  return {
    load: () => {
      loads += 1;

      return stored;
    },
    save: (width) => {
      saves += 1;
      widths.push(width);
    },
    loadCount: () => loads,
    saveCount: () => saves,
    lastSaved: () => widths.at(-1) ?? null,
    savedWidths: () => [...widths],
  };
}
