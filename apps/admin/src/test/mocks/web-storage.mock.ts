/**
 * Deterministic `localStorage` / `sessionStorage` doubles for the
 * "touches no storage" assertions.
 *
 * jsdom's storage objects are **not** a safe premise for an assertion: whether
 * `window.localStorage` exists depends on the jsdom build and on the origin the
 * test environment was created with, and when it is absent, reading
 * `window.localStorage.length` throws a `TypeError` instead of failing an
 * expectation. A test that crashes on the environment cannot prove anything
 * about the component, so the suites install their own recording storage here
 * and assert on the **writes** — which is the behaviour they actually care
 * about.
 *
 * The doubles are installed per test (`vi` cannot undo a `defineProperty`), so
 * every consumer must call `restore()` — see {@link WebStorageHarness}.
 */

import type { ThemeStorage } from '../../app/theme/theme.interface.js';

/** The two `window` properties a component can persist state into. */
export type WebStorageName = 'localStorage' | 'sessionStorage';

/**
 * An in-memory `Storage` that also records how it was used.
 *
 * Counters instead of spies: the tests assert observable behaviour ("nothing was
 * written") and never an internal call order.
 */
export interface RecordingStorage {
  /** Number of stored entries, mirroring `Storage.length`. */
  readonly length: number;
  /** Stored keys in insertion order, mirroring `Storage.key`. */
  key: (index: number) => string | null;
  /** Mirrors `Storage.getItem`. */
  getItem: (key: string) => string | null;
  /** Mirrors `Storage.setItem`; records the key. */
  setItem: (key: string, value: string) => void;
  /** Mirrors `Storage.removeItem`; records the key. */
  removeItem: (key: string) => void;
  /** Mirrors `Storage.clear`; counts the call. */
  clear: () => void;
  /** Keys passed to `setItem`, in call order. */
  writtenKeys: () => readonly string[];
  /** Keys passed to `removeItem`, in call order. */
  removedKeys: () => readonly string[];
  /** How many times `clear()` ran. */
  clearCount: () => number;
  /** `true` while no mutating call (`setItem` / `removeItem` / `clear`) happened. */
  isUntouched: () => boolean;
}

/** The two installed doubles plus the undo of the installation. */
export interface WebStorageHarness {
  /** The double exposed as `window.localStorage`. */
  readonly local: RecordingStorage;
  /** The double exposed as `window.sessionStorage`. */
  readonly session: RecordingStorage;
  /** Puts the original `window` properties back. */
  readonly restore: () => void;
}

/**
 * Builds one recording storage.
 *
 * @param seed - entries the storage starts with; defaults to an empty storage,
 *   which is the first-visit case.
 * @returns the storage and its counters.
 */
function createRecordingStorage(
  seed: Readonly<Record<string, string>> = {},
): RecordingStorage {
  const entries = new Map<string, string>(Object.entries(seed));
  const written: string[] = [];
  const removed: string[] = [];
  let clears = 0;

  return {
    get length(): number {
      return entries.size;
    },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      written.push(key);
      entries.set(key, value);
    },
    removeItem: (key) => {
      removed.push(key);
      entries.delete(key);
    },
    clear: () => {
      clears += 1;
      entries.clear();
    },
    writtenKeys: () => [...written],
    removedKeys: () => [...removed],
    clearCount: () => clears,
    isUntouched: () =>
      written.length === 0 && removed.length === 0 && clears === 0,
  };
}

/**
 * Replaces one `window` storage property with a double.
 *
 * @param name - the property to replace.
 * @param storage - the double to expose there.
 * @returns the undo, which reinstates the original property state.
 */
function replaceStorage(
  name: WebStorageName,
  storage: RecordingStorage,
): () => void {
  const previous = Object.getOwnPropertyDescriptor(window, name);

  Object.defineProperty(window, name, {
    configurable: true,
    enumerable: true,
    writable: true,
    value: storage,
  });

  return () => {
    if (previous === undefined) {
      Reflect.deleteProperty(window, name);

      return;
    }

    Object.defineProperty(window, name, previous);
  };
}

/**
 * A storage whose every read and write throws.
 *
 * Models the environment the theme engine has to survive (AIS-165 D4): a
 * browser that exposes a storage object but refuses to use it — a revoked
 * origin, an exhausted quota, a hardened profile. The engine must fall back to
 * the default appearance instead of failing the boot.
 *
 * @returns the failing storage.
 */
export function createBrokenStorage(): ThemeStorage {
  return {
    getItem: () => {
      throw new Error('storage read denied');
    },
    setItem: () => {
      throw new Error('storage write denied');
    },
  };
}

/**
 * Replaces `window.localStorage` with a property that throws on **access**.
 *
 * Stricter than {@link createBrokenStorage}: some engines throw when the
 * property itself is read, so a guard around the calls alone is not enough.
 *
 * @returns the undo, which reinstates the original property state.
 */
export function installThrowingStorageAccess(): () => void {
  const previous = Object.getOwnPropertyDescriptor(window, 'localStorage');

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error('storage access denied');
    },
  });

  return () => {
    if (previous === undefined) {
      Reflect.deleteProperty(window, 'localStorage');

      return;
    }

    Object.defineProperty(window, 'localStorage', previous);
  };
}

/**
 * Installs fresh recording storages as `window.localStorage` and
 * `window.sessionStorage`.
 *
 * Both are replaced unconditionally, so a leftover entry of an earlier test can
 * never satisfy `isUntouched()` by accident.
 *
 * @param seed - optional initial entries per storage; defaults to both empty.
 * @returns the two doubles and the undo of the installation.
 */
export function installRecordingStorages(
  seed: Partial<Record<WebStorageName, Readonly<Record<string, string>>>> = {},
): WebStorageHarness {
  const local = createRecordingStorage(seed.localStorage);
  const session = createRecordingStorage(seed.sessionStorage);
  const restoreLocal = replaceStorage('localStorage', local);
  const restoreSession = replaceStorage('sessionStorage', session);

  return {
    local,
    session,
    restore: () => {
      restoreLocal();
      restoreSession();
    },
  };
}
