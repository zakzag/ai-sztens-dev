/**
 * Render harness of the notification provider for the admin tests (AIS-84).
 *
 * Gives every test the same three things without touching `sessionStorage`:
 * a real in-memory store (the capture writes into it and the UI reads it back),
 * a memory-only mirror (no browser storage involved), and a deterministic
 * timestamp formatter.
 *
 * A real store is used on purpose here — the provider's contract is
 * "one store, one subscription", and a spy would not exercise the read path.
 */

import {
  createNotificationStorage,
  createNotificationStore,
  type NotificationStorage,
  type NotificationStore,
} from '@callback/notifications';
import { NotificationProvider } from '@callback/notifications/react';
import type { ComponentType, PropsWithChildren, ReactElement } from 'react';

/**
 * Runs the mirror write immediately.
 *
 * The production scheduler coalesces per animation frame; a test has no frames,
 * and an unflushed write would make "the mirror contains the entry" flaky.
 *
 * @param flush - the queued write.
 * @returns a no-op cancel function.
 */
function flushImmediately(flush: () => void): () => void {
  flush();

  return () => undefined;
}

/** Store, mirror and wrapper component of one harness instance. */
export interface NotificationHarness {
  /** The store the tree is rendered from. */
  readonly store: NotificationStore;
  /** The memory-only mirror. */
  readonly storage: NotificationStorage;
  /** `render`/`renderHook` wrapper supplying the provider. */
  readonly Wrapper: ComponentType<PropsWithChildren>;
}

/**
 * @param initialEntries - seeded log, newest first.
 * @returns a fresh harness, isolated from every other test.
 */
export function createNotificationHarness(
  initialEntries: Parameters<typeof createNotificationStore>[0] = {},
): NotificationHarness {
  const storage = createNotificationStorage({
    storage: null,
    schedule: flushImmediately,
  });

  const store = createNotificationStore({
    ...initialEntries,
    initialEntries: storage.load(),
  });

  function Wrapper({ children }: PropsWithChildren): ReactElement {
    return (
      <NotificationProvider
        store={store}
        storage={storage}
        formatTimestamp={(epochMs) => String(epochMs)}
      >
        {children}
      </NotificationProvider>
    );
  }

  return { store, storage, Wrapper };
}
