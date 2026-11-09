import type {
  MutationCacheConfig,
  QueryCacheConfig,
} from '@tanstack/react-query';
import type { NotificationStore } from '@callback/notifications';
import type { HttpEventListener } from '../../services/http-events.interface.js';
import {
  readOperationMeta,
  toHttpEntry,
  toMutationErrorEntry,
  toMutationSuccessEntry,
  toQueryErrorEntry,
} from './notification-events.logic.js';
import type { OperationReader } from './notification.interface.js';

/**
 * The three adapters that turn app events into store writes (AIS-84).
 *
 * Each one is deliberately dumb: it reads the collaborator's arguments, asks the
 * pure mapping function, and emits **only when the mapping returned an entry**.
 * All policy — what is silent, what toasts, what the copy says — lives in
 * `notification-events.logic.ts`.
 *
 * Taking the `NotificationStore` (not the `Notifier` facade) keeps the adapters
 * React-free and makes them usable from `main.tsx` before any component mounts.
 *
 * Since AIS-152 they also forward the **operation** label: a query/mutation reads
 * it from its own `meta`, a HTTP attempt gets it from the injected reader. Neither
 * adapter touches `window` itself, so both stay testable with plain values.
 */

/**
 * @param store - the application's single notification store.
 * @param readOperation - supplies the operation label of a HTTP attempt (the
 *   route reader, injected by the composition root).
 * @returns the listener `services/http-events.ts` is registered with.
 */
export function createHttpEventEmitter(
  store: NotificationStore,
  readOperation: OperationReader,
): HttpEventListener {
  return (event) => {
    store.emit(toHttpEntry(event, readOperation()));
  };
}

/**
 * Cache callbacks of the failed **reads**.
 *
 * TanStack invokes `onError` once per failed query (after the client's own
 * retries), so one broken resource produces one entry; the store's dedupe window
 * turns an immediate repeat into a bumped counter instead of a second card.
 *
 * @param store - the application's single notification store.
 * @returns the config passed to `new QueryCache(…)`.
 */
export function createQueryCacheHandlers(
  store: NotificationStore,
): QueryCacheConfig {
  return {
    onError: (error, query) => {
      const entry = toQueryErrorEntry(error, {
        queryKey: query.queryKey,
        operation: readOperationMeta(query.meta),
      });

      if (entry !== null) {
        store.emit(entry);
      }
    },
  };
}

/**
 * Cache callbacks of the **writes**.
 *
 * Success is announced only when the caller supplied `meta.successMessage`; a
 * generic “saved” toast on every write would be noise. Failure follows the same
 * visibility rule as a failed read.
 *
 * @param store - the application's single notification store.
 * @returns the config passed to `new MutationCache(…)`.
 */
export function createMutationCacheHandlers(
  store: NotificationStore,
): MutationCacheConfig {
  return {
    onSuccess: (_data, _variables, _context, mutation) => {
      const entry = toMutationSuccessEntry({
        meta: mutation.meta,
        mutationKey: mutation.options.mutationKey,
        operation: readOperationMeta(mutation.meta),
      });

      if (entry !== null) {
        store.emit(entry);
      }
    },
    onError: (error, _variables, _context, mutation) => {
      const entry = toMutationErrorEntry(error, {
        mutationKey: mutation.options.mutationKey,
        operation: readOperationMeta(mutation.meta),
      });

      if (entry !== null) {
        store.emit(entry);
      }
    },
  };
}
