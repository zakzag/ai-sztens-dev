/**
 * Bridge between the TanStack Query cache and `useSyncExternalStore`.
 *
 * `getQueryCache().getAll()` allocates a new array on every call, so handing it
 * straight to React would re-render forever. The store therefore keeps one
 * snapshot array, replaces it only when the set of errors actually changes, and
 * notifies listeners only then.
 *
 * Nothing is *stored* here beyond that identity: the errors themselves live in
 * the cache, so the app-level banner cannot drift from the server state.
 */

import type { QueryClient } from '@tanstack/react-query';
import type { QueryErrorStore } from './error-surface.interface.js';

/**
 * @param queryClient - the client whose cache is observed.
 * @returns the current `error` of every query that has one.
 */
function collectQueryErrors(queryClient: QueryClient): readonly unknown[] {
  return queryClient
    .getQueryCache()
    .getAll()
    .map((query) => query.state.error)
    .filter((error) => error !== null);
}

/**
 * @param current - the current snapshot.
 * @param next - the freshly collected errors.
 * @returns `true` when both hold the same errors in the same order.
 */
function hasSameErrors(current: readonly unknown[], next: readonly unknown[]): boolean {
  if (current.length !== next.length) {
    return false;
  }

  return current.every((error, index) => error === next[index]);
}

/**
 * Creates the subscription store of one query client.
 *
 * @param queryClient - the client to observe.
 * @returns the store; call `dispose()` when the owning component unmounts.
 */
export function createQueryErrorStore(queryClient: QueryClient): QueryErrorStore {
  let snapshot = collectQueryErrors(queryClient);
  const listeners = new Set<() => void>();

  const unsubscribeCache = queryClient.getQueryCache().subscribe(() => {
    const next = collectQueryErrors(queryClient);

    if (hasSameErrors(snapshot, next)) {
      return;
    }

    snapshot = next;

    for (const listener of listeners) {
      listener();
    }
  });

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    getErrors: () => snapshot,
    dispose: () => {
      unsubscribeCache();
      listeners.clear();
    },
  };
}
