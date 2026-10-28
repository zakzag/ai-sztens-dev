/**
 * Feature-local types of the error-surface feature.
 *
 * `useAppErrorBanner` subscribes to the TanStack Query cache instead of copying
 * server state into a store: the cache *is* the source, the store below only
 * turns “the cache changed” into a stable snapshot React can compare.
 */

/**
 * Read-only projection of the query cache's errors.
 *
 * `getErrors()` must return the same array identity while nothing changed,
 * otherwise `useSyncExternalStore` re-renders forever.
 */
export interface QueryErrorStore {
  /** Registers a listener; returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Every non-`null` query error, in cache order. */
  readonly getErrors: () => readonly unknown[];
  /** Detaches from the query cache. */
  readonly dispose: () => void;
}
