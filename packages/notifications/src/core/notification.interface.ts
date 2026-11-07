/**
 * Severity vocabulary of a notification or a system log entry.
 *
 * Declared here on purpose (AIS-79 decision D1): this package is framework-free
 * and must never import `@callback/ui`, whose types pull React in. The UI kit
 * declares the same five literals as `ToastLevel`; `NOTIFICATION_LEVELS` and the
 * UI's `TOAST_LEVEL_GLYPHS` keys are both asserted in tests, so the two cannot
 * drift apart silently (D2). If the vocabulary ever changes, both sides change
 * in the same commit.
 */
export type NotificationLevel = 'success' | 'error' | 'warning' | 'info' | 'system';

/**
 * Where an entry came from.
 *
 * Used for filtering the log panel and for explaining a message in context.
 */
export type NotificationSource = 'form' | 'api' | 'router' | 'runtime' | 'manual';

/**
 * One labelled technical fact of an entry, rendered by the expandable log row.
 *
 * `label` is supplied by the emitter: this package carries no i18n, so the core
 * never invents user-facing text (AIS-79 decision D15). `value` is already
 * redacted, serialised and length-clamped by the store, so anything reaching a
 * consumer is safe to render as it is.
 */
export interface NotificationDetailField {
  /** Name of the fact, e.g. `requestId`. Emitter-owned, already truncated. */
  readonly label: string;
  /** Redacted, serialised and truncated value. */
  readonly value: string;
  /** Asks for a monospace rendering (ids, query strings, stack traces). */
  readonly mono?: boolean;
}

/**
 * One notification or system message.
 *
 * Immutable by contract: the store replaces entries instead of mutating them, so
 * a snapshot handed to `useSyncExternalStore` never changes underneath a render.
 */
export interface NotificationEntry {
  /** Stable identifier, unique within the store instance. */
  readonly id: string;
  readonly level: NotificationLevel;
  /** Already-localised, human-readable sentence chosen by the emitter. */
  readonly message: string;
  /** Redacted technical context: HTTP status, request URL, stack trace. */
  readonly detail?: string;
  /**
   * Structured context of the expandable log row.
   *
   * Complements {@link NotificationEntry.detail} rather than replacing it
   * (AIS-151 decision D-A): `detail` stays the one-line summary the toast and
   * the collapsed row show, `details` is only read when the row is opened and is
   * never forwarded to a toast (D-C). `undefined` — never an empty list — when
   * the emitter supplied nothing, so a snapshot never carries empty arrays.
   */
  readonly details?: readonly NotificationDetailField[];
  readonly source: NotificationSource;
  /** Creation time in epoch milliseconds, refreshed when a duplicate is bumped. */
  readonly createdAt: number;
  /** Drives the unseen badge of the log drawer. */
  readonly read: boolean;
  /** `false` for pure log entries (system noise) that never become a toast. */
  readonly toast: boolean;
  /** `1` for a new entry, incremented for each deduplicated repeat. */
  readonly repeatCount: number;
}

/**
 * Immutable store snapshot.
 *
 * Both lists are **newest first** (index `0` is the newest): the toast stack and
 * the log panel render in that order, and `trimEntries` therefore drops from the
 * end of `entries` (AIS-79 decision D5).
 */
export interface NotificationState {
  readonly entries: readonly NotificationEntry[];
  /** Ids of the entries that should currently be shown as toasts, newest first. */
  readonly toasts: readonly string[];
}

/**
 * The fields that decide whether an emit repeats an existing entry.
 *
 * Dedupe compares the pair only, so the same sentence from the same level inside
 * the window bumps a counter instead of stacking a second toast.
 */
export interface NotificationIdentity {
  readonly level: NotificationLevel;
  readonly message: string;
}

/**
 * Input of {@link NotificationStore.emit}.
 */
export interface EmitNotificationInput extends NotificationIdentity {
  readonly source: NotificationSource;
  /**
   * Technical context.
   *
   * A record is redacted by the store before it is serialised, so no emitter can
   * bypass redaction (AIS-79 decision D9); a plain string is stored as it is.
   */
  readonly detail?: string | Readonly<Record<string, unknown>>;
  /**
   * Structured context for the expandable log row (AIS-151).
   *
   * Both shapes travel the same redaction path as {@link EmitNotificationInput.detail}:
   * a record keeps its insertion order and every value is redacted by its key, an
   * already-built field list is re-redacted by its `label` and clamped. Redaction
   * stays a store responsibility, so no emitter can skip it (D-B).
   */
  readonly details?: readonly NotificationDetailField[] | Readonly<Record<string, unknown>>;
  /** Overrides the default (`level !== 'system'`, decision D11). */
  readonly toast?: boolean;
}

/** Subscriber callback of {@link NotificationStore.subscribe}. */
export type NotificationListener = () => void;

/**
 * Receives an error thrown by a subscriber.
 *
 * The default implementation logs to `console.error` when a console exists; the
 * store never lets one broken subscriber silence the remaining ones (D12).
 */
export type NotificationListenerErrorHandler = (error: unknown) => void;

/**
 * Construction options of {@link createNotificationStore}.
 *
 * Everything that touches the outside world (`now`, the logger) is injected so
 * the store stays deterministic in tests and free of DOM/Node specifics.
 */
export interface NotificationStoreOptions {
  /** Clock; defaults to `Date.now`. */
  readonly now?: () => number;
  /** Ring-buffer size of `entries`; defaults to `NOTIFICATION_MAX_ENTRIES`. */
  readonly maxEntries?: number;
  /** How many toast ids the state keeps; defaults to `NOTIFICATION_MAX_VISIBLE_TOASTS`. */
  readonly maxVisibleToasts?: number;
  /** Dedupe window in milliseconds; defaults to `NOTIFICATION_DEDUPE_WINDOW_MS`. */
  readonly dedupeWindowMs?: number;
  /**
   * Entries restored by a caller (AIS-80/83).
   *
   * Only `entries` are seeded: `toasts` always starts empty so a reload never
   * resurrects an already expired toast (AIS-79 decision D10).
   */
  readonly initialEntries?: readonly NotificationEntry[];
  /** Replacement for the default subscriber-error logger (D12). */
  readonly onListenerError?: NotificationListenerErrorHandler;
}

/**
 * The notification/log store.
 *
 * Framework-independent: no React, no DOM, no storage. A UI subscribes to it
 * (`subscribe` + `getSnapshot`), it never owns the data.
 */
export interface NotificationStore {
  /**
   * Adds an entry, or bumps the matching one within the dedupe window.
   *
   * @param input - severity, message, source and optional technical detail.
   * @returns the stored entry: the new one, or the bumped existing one.
   */
  emit(input: EmitNotificationInput): NotificationEntry;

  /**
   * Hides a toast. The log entry itself is kept.
   *
   * @param id - id of the toast to hide; an unknown id is a no-op.
   */
  dismiss(id: string): void;

  /** Marks every entry as read; drives the unseen badge of the log drawer. */
  markAllRead(): void;

  /** Drops every entry and toast. */
  clear(): void;

  /**
   * Registers a listener that is called after every state change.
   *
   * @param listener - called without arguments, once per committed change.
   * @returns an unsubscribe function.
   */
  subscribe(listener: NotificationListener): () => void;

  /**
   * Current state.
   *
   * Referentially stable while nothing changes, which is what
   * `useSyncExternalStore` requires to avoid an endless re-render loop.
   */
  getSnapshot(): NotificationState;

  /** Server/SSR snapshot: always the empty state, same reference every call. */
  getServerSnapshot(): NotificationState;
}

/**
 * Catalogued event kinds, so an emitter never invents a new spelling.
 *
 * The kinds are vocabulary only — the user-facing sentence is supplied by the
 * caller, because this package knows nothing about localisation (D15).
 */
export type NotificationEventKind =
  | 'api.failure'
  | 'api.schema-drift'
  | 'mutation.failure'
  | 'form.success'
  | 'runtime.error'
  | 'router.navigation';

/**
 * Default classification of a catalogued event kind.
 *
 * Deliberately contains no message: only how an event should be classified.
 */
export interface NotificationEventDefaults {
  readonly level: NotificationLevel;
  readonly source: NotificationSource;
  readonly toast: boolean;
}
