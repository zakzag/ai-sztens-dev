import {
  createNotificationStorage,
  createNotificationStore,
  type NotificationStorage,
  type NotificationStore,
  type StorageLike,
} from '@callback/notifications';
import {
  createRafScheduler,
  type AnimationFrameScope,
} from '@callback/notifications/react';

/**
 * The **single** notification store of the admin application (AIS-84).
 *
 * One instance has to be shared by three parties:
 *
 * 1. the `QueryCache` / `MutationCache` callbacks (created in `main.tsx` before
 *    React mounts),
 * 2. the HTTP event listener (`services/http-events.ts`),
 * 3. `<NotificationProvider store storage>`, which renders it.
 *
 * Creating it here — outside React — is what makes (1) and (2) possible at all;
 * a store created inside the provider would only exist after the first render,
 * and every request sent before it would be lost.
 *
 * The `sessionStorage` mirror is created here as well, because an **injected**
 * store is not seeded by the provider: the restore has to happen before the
 * store exists (AIS-83 `D3`).
 */

/**
 * @returns the `window`, or `null` in a non-browser environment.
 *
 * The module is imported by tests (jsdom, so `window` exists) and would be
 * imported by any future SSR entry point, where a bare `window` would throw at
 * import time.
 */
function readWindow(): AnimationFrameScope | null {
  return typeof window === 'undefined' ? null : window;
}

/**
 * @returns `sessionStorage`, or `null` when it is blocked (private mode, denied
 *   cookies). A blocked storage degrades to memory-only, it never throws.
 */
function readSessionStorage(): StorageLike | null {
  const win = readWindow();

  if (win === null) {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    // Intentional: an unreachable storage must not break the boot.
    return null;
  }
}

/** Mirror of the log in `sessionStorage`; memory-only when storage is blocked. */
export const notificationStorage: NotificationStorage = createNotificationStorage({
  storage: readSessionStorage(),
  schedule: createRafScheduler(readWindow()),
});

/** The store every emitter writes to and `<NotificationProvider>` renders. */
export const notificationStore: NotificationStore = createNotificationStore({
  initialEntries: notificationStorage.load(),
});
