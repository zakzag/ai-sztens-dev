import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { LogLevelFilter, ToastItem } from '@callback/ui';
import type { NotificationEntry } from '../core/notification.interface.js';
import { useNotificationContext } from './notification.context.js';
import { LOG_INITIAL_PAGE, LOG_PAGE_STEP } from './notification-react.const.js';
import {
  countUnseen,
  filterEntries,
  hasMoreEntries,
  resolveToastTtl,
  sliceWindow,
  toToastItems,
} from './notification-react.logic.js';
import type {
  LogDrawerController,
  ToastTimerControls,
} from './notification-react.interface.js';

/** Handle type of a scheduled dismissal; numeric in the DOM, opaque in Node. */
type TimerHandle = ReturnType<typeof setTimeout>;

/**
 * The toasts the host should render, newest first.
 *
 * Subscribes to the store's own snapshot (referentially stable while nothing
 * changes) and derives the projected list in `useMemo`. Deriving inside
 * `getSnapshot` would allocate on every call and make React loop forever
 * (AIS-83 decision D4).
 *
 * @returns toast items in the order the store keeps them, newest at index `0`.
 */
export function useToasts(): readonly ToastItem[] {
  const { store } = useNotificationContext('useToasts');
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  return useMemo(() => toToastItems(state.entries, state.toasts), [state.entries, state.toasts]);
}

/**
 * Open/closed, filter and paging state of the log drawer.
 *
 * Pure UI state, so it is local `useState`: nothing here is server data, nothing
 * needs to survive a reload, and no second component shares it (AIS-83 D7). The
 * store keeps the content; this hook only decides how much of it is visible.
 *
 * @returns the controller the host — or a custom host — binds to `LogDrawer`.
 */
export function useLogDrawer(): LogDrawerController {
  const { store, storage } = useNotificationContext('useLogDrawer');
  const [isOpen, setIsOpen] = useState(false);
  const [levelFilter, setLevelFilterState] = useState<LogLevelFilter>('all');
  const [visibleCount, setVisibleCount] = useState(LOG_INITIAL_PAGE);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const filtered = useMemo(
    () => filterEntries(state.entries, levelFilter),
    [state.entries, levelFilter],
  );
  const unseenCount = useMemo(() => countUnseen(state.entries), [state.entries]);

  const toggle = useCallback(() => {
    setIsOpen((open) => !open);

    // Marking read belongs to the opening action, not to an effect watching
    // `isOpen`: one write per click, and StrictMode cannot replay it (D8).
    if (!isOpen) {
      store.markAllRead();
    }
  }, [isOpen, store]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setLevelFilter = useCallback((filter: LogLevelFilter) => {
    setLevelFilterState(filter);
    setVisibleCount(LOG_INITIAL_PAGE);
  }, []);

  const loadMore = useCallback(() => {
    setVisibleCount((count) => count + LOG_PAGE_STEP);
  }, []);

  const clear = useCallback(() => {
    // Store first, then the mirror: `clear()` cancels the write that the store
    // notification just queued, so "Törlés" cannot be undone by a pending flush.
    store.clear();
    storage.clear();
  }, [store, storage]);

  return useMemo(
    () => ({
      isOpen,
      levelFilter,
      visibleCount,
      hasMore: hasMoreEntries(filtered, visibleCount),
      unseenCount,
      toggle,
      close,
      setLevelFilter,
      loadMore,
      clear,
    }),
    [
      isOpen,
      levelFilter,
      visibleCount,
      filtered,
      unseenCount,
      toggle,
      close,
      setLevelFilter,
      loadMore,
      clear,
    ],
  );
}

/**
 * The rows `LogDrawer` should render.
 *
 * The window lives in the controller, so every caller that owns a controller gets
 * the same paging policy; the hook itself stays a pure projection of
 * `state.entries` through `filterEntries` and `sliceWindow`.
 *
 * @param controller - the drawer state the caller owns.
 * @returns filtered, windowed entries, newest first.
 */
export function useLogEntries(
  controller: LogDrawerController,
): readonly NotificationEntry[] {
  const { store } = useNotificationContext('useLogEntries');
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  return useMemo(() => {
    const filtered = filterEntries(state.entries, controller.levelFilter);

    return sliceWindow(filtered, controller.visibleCount);
  }, [state.entries, controller.levelFilter, controller.visibleCount]);
}

/**
 * Owns the auto-dismiss timers of the visible toasts.
 *
 * The single place where a toast decides *when* it disappears (AIS-83 D5):
 *
 * - one `setTimeout` per toast id; `success`/`info` 4 s, `warning` 6 s, `error`
 *   and `system` never expire on their own;
 * - `pause` clears the timer, `resume` restarts a **full** TTL — the toast the
 *   user is reading must not vanish, and remaining-time bookkeeping would need a
 *   second clock for no extra value (D6);
 * - while the document is hidden no timer runs; becoming visible again restarts
 *   the countdown of everything still on screen;
 * - unmount clears every handle, so no `setState` lands on a gone component.
 *
 * @param toasts - the currently visible toasts (see `useToasts`).
 * @returns the pause/resume callbacks `ToastStack` expects.
 */
export function useToastTimers(toasts: readonly ToastItem[]): ToastTimerControls {
  const { store } = useNotificationContext('useToastTimers');
  const timers = useRef<Map<string, TimerHandle>>(new Map());
  const pausedIds = useRef<Set<string>>(new Set());
  const latestToasts = useRef<readonly ToastItem[]>([]);

  const clearTimer = useCallback((id: string): void => {
    const handle = timers.current.get(id);

    if (handle !== undefined) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const scheduleTimer = useCallback(
    (toast: ToastItem): void => {
      if (timers.current.has(toast.id) || pausedIds.current.has(toast.id)) {
        return;
      }

      const ttl = resolveToastTtl(toast.level);

      if (ttl === null) {
        return;
      }

      timers.current.set(
        toast.id,
        setTimeout(() => {
          timers.current.delete(toast.id);
          store.dismiss(toast.id);
        }, ttl),
      );
    },
    [store],
  );

  useEffect(() => {
    latestToasts.current = toasts;

    const visibleIds = new Set(toasts.map((toast) => toast.id));

    for (const id of [...timers.current.keys()]) {
      if (!visibleIds.has(id)) {
        clearTimer(id);
        pausedIds.current.delete(id);
      }
    }

    for (const toast of toasts) {
      scheduleTimer(toast);
    }
  }, [toasts, clearTimer, scheduleTimer]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const handleVisibility = (): void => {
      if (document.hidden) {
        for (const id of [...timers.current.keys()]) {
          clearTimer(id);
        }

        return;
      }

      for (const toast of latestToasts.current) {
        scheduleTimer(toast);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [clearTimer, scheduleTimer]);

  useEffect(
    () => () => {
      for (const handle of timers.current.values()) {
        clearTimeout(handle);
      }

      timers.current.clear();
      pausedIds.current.clear();
    },
    [],
  );

  const pause = useCallback(
    (id: string): void => {
      pausedIds.current.add(id);
      clearTimer(id);
    },
    [clearTimer],
  );

  const resume = useCallback(
    (id: string): void => {
      pausedIds.current.delete(id);

      const toast = latestToasts.current.find((candidate) => candidate.id === id);

      if (toast !== undefined) {
        scheduleTimer(toast);
      }
    },
    [scheduleTimer],
  );

  return useMemo(() => ({ pause, resume }), [pause, resume]);
}
