import type { NotificationEntry } from './notification.interface.js';

/**
 * Schema version of the persisted envelope.
 *
 * A single literal today (AIS-80 decision D2). It exists as a type so the constant
 * in `notification.const.ts` and the envelope interface cannot drift apart: the
 * constant is annotated with it, and a future `2` must widen both in one commit.
 */
export type PersistedEnvelopeVersion = 1;

/**
 * The minimal storage surface the adapter needs.
 *
 * Declared structurally on purpose: the package builds with `lib: ["ES2022"]` only,
 * so neither the DOM `Storage` type nor `sessionStorage` is available here. The app
 * passes `window.sessionStorage` at the composition root (AIS-83), tests pass an
 * in-memory fake — both satisfy this interface (AIS-80 decision D10).
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * What is stored under the mirror key.
 *
 * Only `entries` are persisted (AIS-80 decision D14): restoring `toasts` would
 * resurrect cards that already expired, and their timers cannot be revived at all.
 */
export interface PersistedNotificationLog {
  readonly version: PersistedEnvelopeVersion;
  /** Newest first, exactly like {@link import('./notification.interface.js').NotificationState.entries}. */
  readonly entries: readonly NotificationEntry[];
}

/**
 * Why a stored payload was not usable.
 *
 * - `missing` — no key, or an empty string; a normal first visit, not a defect.
 * - `malformed-json` — `JSON.parse` failed.
 * - `wrong-version` — a foreign or future schema; phase 1 has no migration.
 * - `wrong-shape` — the envelope or at least one entry failed validation.
 */
export type PersistedEnvelopeRejection = 'missing' | 'malformed-json' | 'wrong-version' | 'wrong-shape';

/** A payload that passed validation. */
export interface PersistedEnvelopeAccepted {
  readonly ok: true;
  readonly entries: readonly NotificationEntry[];
}

/** A payload that must not be used. */
export interface PersistedEnvelopeRejected {
  readonly ok: false;
  readonly reason: PersistedEnvelopeRejection;
}

/**
 * Result of reading the mirror.
 *
 * A discriminated result rather than an exception: a rejected payload is an
 * expected outcome (first visit, foreign tab, cleared storage) and must never
 * break the app (AIS-80 decisions D3 and D13).
 */
export type PersistedEnvelopeReadResult = PersistedEnvelopeAccepted | PersistedEnvelopeRejected;

/** Cancels a scheduled write that has not run yet. */
export type NotificationWriteCancel = () => void;

/**
 * Coalesces a burst of `save` calls into one write.
 *
 * Injected because the core cannot reach `requestAnimationFrame`: the default is a
 * microtask, and AIS-83 passes an rAF-based implementation (AIS-80 decision D6).
 */
export type NotificationWriteScheduler = (flush: () => void) => NotificationWriteCancel;

/**
 * Construction options of {@link NotificationStorage}.
 *
 * Everything that touches the outside world is injected, so the adapter is
 * deterministic in tests and free of DOM specifics.
 */
export interface NotificationStorageOptions {
  /**
   * Backing storage. `undefined` or `null` means **memory-only mode**: the adapter
   * accepts calls and does nothing (AIS-80 decision D12).
   */
  readonly storage?: StorageLike | null;
  /** Mirror key; defaults to `NOTIFICATION_STORAGE_KEY`. */
  readonly key?: string;
  /** Entry cap of the mirror; defaults to `NOTIFICATION_STORAGE_MAX_ENTRIES`. */
  readonly cap?: number;
  /** Write coalescer; defaults to a microtask scheduler (D6). */
  readonly schedule?: NotificationWriteScheduler;
}

/**
 * The `sessionStorage` mirror of the notification log.
 *
 * Deliberately not bound to a store: the app reads `load()` once, seeds
 * `createNotificationStore({ initialEntries })` with it, then forwards each
 * `entries` snapshot to `save()` and calls `flush()` on `pagehide` (AIS-83).
 */
export interface NotificationStorage {
  /**
   * Reads and validates the mirror.
   *
   * @returns the restored entries, newest first and trimmed to the cap; an empty
   *   list for a missing, unreadable or rejected payload.
   */
  load(): readonly NotificationEntry[];

  /**
   * Schedules a write of the supplied entries.
   *
   * Repeated calls inside one scheduled tick collapse into a single `setItem`
   * carrying the **last** payload (D6). A payload identical to the last written
   * (or restored) one is skipped (D9).
   *
   * @param entries - newest-first list, as read from the store snapshot.
   */
  save(entries: readonly NotificationEntry[]): void;

  /** Writes a pending payload synchronously, e.g. from a `pagehide` handler (D7). */
  flush(): void;

  /**
   * Drops a pending write and removes the mirror key (D8).
   *
   * The pending write is cancelled first, so a queued flush cannot resurrect the
   * key right after the user cleared the log.
   */
  clear(): void;
}
