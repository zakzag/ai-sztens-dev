/**
 * Notification store double for the admin capture tests (AIS-84).
 *
 * The capture adapters only ever *write* to the store, so the double records the
 * `emit` payloads and nothing else. Assertions therefore talk about the entry
 * that was produced, not about how the real store would have stored it — that
 * behaviour belongs to `packages/notifications` and is tested there.
 */

import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type {
  EmitNotificationInput,
  NotificationEntry,
  NotificationState,
  NotificationStore,
} from '@callback/notifications';

/** The spy reports an empty state: the double stores nothing. */
const EMPTY_STATE: NotificationState = { entries: [], toasts: [] };

/** Start of the fabricated `createdAt` values, one second apart. */
const BASE_CREATED_AT = 1_700_000_000_000;

/**
 * @param input - what the adapter emitted.
 * @param sequence - call index, so the fabricated entries differ.
 * @returns a stored-entry lookalike.
 */
function toEntry(input: EmitNotificationInput, sequence: number): NotificationEntry {
  return {
    id: `spy-${sequence}`,
    level: input.level,
    message: input.message,
    detail: typeof input.detail === 'string' ? input.detail : undefined,
    source: input.source,
    createdAt: BASE_CREATED_AT + sequence,
    read: false,
    toast: input.toast ?? input.level !== 'system',
    repeatCount: 1,
  };
}

/** A {@link NotificationStore} whose `emit` records every payload. */
export interface NotificationStoreSpy extends NotificationStore {
  /** The recorded `emit` calls. */
  readonly emit: Mock<(input: EmitNotificationInput) => NotificationEntry>;
  /** Everything that was emitted, in order. */
  readonly emitted: readonly EmitNotificationInput[];
}

/**
 * @returns a store double that records `emit` and ignores every other call.
 */
export function createNotificationStoreSpy(): NotificationStoreSpy {
  const emitted: EmitNotificationInput[] = [];

  const emit = vi.fn((input: EmitNotificationInput): NotificationEntry => {
    emitted.push(input);

    return toEntry(input, emitted.length - 1);
  });

  return {
    get emitted() {
      return emitted;
    },
    emit,
    dismiss: vi.fn<(id: string) => void>(),
    markAllRead: vi.fn<() => void>(),
    clear: vi.fn<() => void>(),
    subscribe: vi.fn<() => () => void>(() => () => undefined),
    getSnapshot: () => EMPTY_STATE,
    getServerSnapshot: () => EMPTY_STATE,
  };
}
