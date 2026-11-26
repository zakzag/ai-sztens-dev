import type { NotificationEntry } from '../../src/core/notification.interface.js';
import type {
  NotificationWriteCancel,
  NotificationWriteScheduler,
  StorageLike,
} from '../../src/core/notification.storage.interface.js';
import { NOTIFICATION_STORAGE_KEY, NOTIFICATION_STORAGE_VERSION } from '../../src/core/notification.const.js';

/**
 * How often a fake storage call was performed.
 *
 * Counters are exposed instead of spying on the object, so the adapter tests assert
 * observable behaviour (one write per tick) rather than implementation details.
 */
export interface StorageCallCounts {
  readonly getItem: number;
  readonly setItem: number;
  readonly removeItem: number;
}

/** The fake storage plus its recorded state. */
export interface TestStorage {
  readonly storage: StorageLike;
  readonly counts: StorageCallCounts;
  /** Raw value currently held under a key, as the adapter wrote it. */
  peek(key?: string): string | null;
  /** Seeds a raw payload, bypassing the adapter. */
  seed(value: string | null, key?: string): void;
  /** Makes `setItem` throw (quota exceeded / disabled storage) until toggled off. */
  setWriteFailure(failing: boolean): void;
  /** Makes `getItem` and `removeItem` throw until toggled off. */
  setReadFailure(failing: boolean): void;
}

/**
 * Builds an in-memory {@link StorageLike}.
 *
 * Honest by default; the two failure switches reproduce the only two real-world
 * failure modes (quota on write, blocked storage on read/remove).
 *
 * @returns the fake storage, its counters and the failure switches.
 */
export function createTestStorage(): TestStorage {
  const store = new Map<string, string>();
  const counts = { getItem: 0, setItem: 0, removeItem: 0 };
  let writeFails = false;
  let readFails = false;

  return {
    storage: {
      getItem: (key: string): string | null => {
        counts.getItem += 1;

        if (readFails) {
          throw new Error('storage unavailable');
        }

        return store.get(key) ?? null;
      },
      setItem: (key: string, value: string): void => {
        counts.setItem += 1;

        if (writeFails) {
          throw new Error('QuotaExceededError');
        }

        store.set(key, value);
      },
      removeItem: (key: string): void => {
        counts.removeItem += 1;

        if (readFails) {
          throw new Error('storage unavailable');
        }

        store.delete(key);
      },
    },
    counts,
    peek: (key: string = NOTIFICATION_STORAGE_KEY): string | null => store.get(key) ?? null,
    seed: (value: string | null, key: string = NOTIFICATION_STORAGE_KEY): void => {
      if (value === null) {
        store.delete(key);
      } else {
        store.set(key, value);
      }
    },
    setWriteFailure: (failing: boolean): void => {
      writeFails = failing;
    },
    setReadFailure: (failing: boolean): void => {
      readFails = failing;
    },
  };
}

/** One scheduled tick of the manual scheduler. */
interface PendingTick {
  readonly flush: () => void;
  cancelled: boolean;
}

/** The manual scheduler plus the controls the coalescing tests need. */
export interface TestScheduler {
  readonly schedule: NotificationWriteScheduler;
  /** How many flushes were requested by the adapter. */
  readonly scheduleCount: () => number;
  /** Runs the runnable flush, if any (a cancelled tick does nothing). */
  runPending(): void;
  /** Number of flushes that are still pending. */
  readonly pendingCount: () => number;
}

/**
 * Builds a scheduler whose ticks the test drives explicitly.
 *
 * No timers, no `vi.useFakeTimers()`: a tick is whatever the test decides it is.
 *
 * @returns the scheduler and its controls.
 */
export function createTestScheduler(): TestScheduler {
  const pending = new Map<number, PendingTick>();
  let sequence = 0;
  let scheduled = 0;

  return {
    schedule: (flush: () => void): NotificationWriteCancel => {
      sequence += 1;
      scheduled += 1;
      const id = sequence;

      pending.set(id, { flush, cancelled: false });

      return () => {
        const tick = pending.get(id);

        if (tick !== undefined) {
          tick.cancelled = true;
        }
      };
    },
    scheduleCount: () => scheduled,
    runPending: (): void => {
      for (const id of [...pending.keys()]) {
        const tick = pending.get(id);

        pending.delete(id);

        if (tick !== undefined && !tick.cancelled) {
          tick.flush();
        }
      }
    },
    pendingCount: () => [...pending.values()].filter((tick) => !tick.cancelled).length,
  };
}

/**
 * Serialises an arbitrary payload under the mirror key.
 *
 * Used for the "foreign payload" cases (wrong version, broken entry, plain text),
 * which must never be produced by the adapter itself.
 *
 * @param payload - JSON-serialisable value, or a raw string used verbatim.
 * @param key - mirror key; defaults to the production key.
 * @returns the configured fake storage, seeded with the payload.
 */
export function createStorageWithPayload(payload: unknown, key: string = NOTIFICATION_STORAGE_KEY): TestStorage {
  const testStorage = createTestStorage();

  testStorage.seed(typeof payload === 'string' ? payload : JSON.stringify(payload), key);

  return testStorage;
}

/**
 * Serialises a correct envelope around the supplied entries.
 *
 * @param entries - entries to store, newest first.
 * @param key - mirror key; defaults to the production key.
 * @returns the configured fake storage.
 */
export function createStorageWithEntries(
  entries: readonly NotificationEntry[],
  key: string = NOTIFICATION_STORAGE_KEY,
): TestStorage {
  return createStorageWithPayload({ version: NOTIFICATION_STORAGE_VERSION, entries }, key);
}

/**
 * Builds a list of entries whose ids encode their position.
 *
 * @param count - how many entries to build, newest first.
 * @returns the entries, index 0 being the newest.
 */
export function createTestEntryList(count: number): readonly NotificationEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `ntf-storage-${index}`,
    level: index % 2 === 0 ? 'info' : 'error',
    message: `üzenet-${index}`,
    source: 'manual',
    createdAt: 1_700_000_000_000 - index,
    read: index % 3 === 0,
    toast: index % 4 !== 0,
    repeatCount: 1,
  }));
}
