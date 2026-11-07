import { describe, expect, it, vi } from 'vitest';

import {
  EMPTY_NOTIFICATION_STATE,
  NOTIFICATION_MAX_ENTRIES,
  NOTIFICATION_MAX_VISIBLE_TOASTS,
  NOTIFICATION_REDACTED_PLACEHOLDER,
} from '../src/core/notification.const.js';
import type {
  EmitNotificationInput,
  NotificationStoreOptions,
} from '../src/core/notification.interface.js';
import { createNotificationStore } from '../src/core/notification.store.js';
import {
  FIXED_NOW,
  createTestClock,
  createTestDetailField,
  createTestDetailsRecord,
  createTestEntry,
} from './mocks/notification.fixtures.js';

const SUCCESS_INPUT: EmitNotificationInput = {
  level: 'success',
  message: 'Sikeres mentés',
  source: 'form',
};

const ERROR_INPUT: EmitNotificationInput = {
  level: 'error',
  message: 'Sikertelen mentés',
  source: 'api',
};

interface TestStore {
  readonly store: ReturnType<typeof createNotificationStore>;
  readonly clock: ReturnType<typeof createTestClock>;
  readonly onListenerError: ReturnType<typeof vi.fn>;
}

function createTestStore(overrides: Partial<NotificationStoreOptions> = {}): TestStore {
  const clock = createTestClock();
  const onListenerError = vi.fn();

  return {
    store: createNotificationStore({ now: clock.now, onListenerError, ...overrides }),
    clock,
    onListenerError,
  };
}

function emitUnique(store: ReturnType<typeof createNotificationStore>, count: number): readonly string[] {
  return Array.from({ length: count }, (_, index) => {
    const entry = store.emit({ level: 'info', message: `üzenet-${index}`, source: 'manual' });

    return entry.id;
  });
}

describe('createNotificationStore — initial state', () => {
  it('starts from the frozen empty snapshot', () => {
    const store = createNotificationStore();

    expect(store.getSnapshot()).toBe(EMPTY_NOTIFICATION_STATE);
  });

  it('seeds restored entries but never restored toasts', () => {
    const initialEntries = [
      createTestEntry({ id: 'newer', toast: true, createdAt: FIXED_NOW }),
      createTestEntry({ id: 'older', toast: true, createdAt: FIXED_NOW - 1 }),
    ];
    const { store } = createTestStore({ initialEntries });

    expect(store.getSnapshot().entries.map((entry) => entry.id)).toEqual(['newer', 'older']);
    expect(store.getSnapshot().toasts).toEqual([]);
  });

  it('trims restored entries to the configured cap', () => {
    const initialEntries = [
      createTestEntry({ id: 'a' }),
      createTestEntry({ id: 'b' }),
      createTestEntry({ id: 'c' }),
    ];
    const { store } = createTestStore({ initialEntries, maxEntries: 2 });

    expect(store.getSnapshot().entries.map((entry) => entry.id)).toEqual(['a', 'b']);
  });
});

describe('createNotificationStore — emit', () => {
  it('creates an entry with every documented field', () => {
    const { store } = createTestStore();

    const entry = store.emit(SUCCESS_INPUT);

    expect(entry).toMatchObject({
      level: 'success',
      message: 'Sikeres mentés',
      source: 'form',
      createdAt: FIXED_NOW,
      read: false,
      toast: true,
      repeatCount: 1,
    });
    expect(entry.id).toBe(`ntf-${FIXED_NOW.toString(36)}-1`);
    expect(store.getSnapshot().entries[0]).toBe(entry);
    expect(store.getSnapshot().toasts).toEqual([entry.id]);
  });

  it('does not toast a system entry by default', () => {
    const { store } = createTestStore();

    const entry = store.emit({ level: 'system', message: 'HTTP 200 GET /api/api-keys', source: 'api' });

    expect(entry.toast).toBe(false);
    expect(store.getSnapshot().toasts).toEqual([]);
    expect(store.getSnapshot().entries).toHaveLength(1);
  });

  it('honours an explicit toast flag', () => {
    const { store } = createTestStore();

    const entry = store.emit({ ...SUCCESS_INPUT, toast: false });

    expect(entry.toast).toBe(false);
    expect(store.getSnapshot().toasts).toEqual([]);
  });

  it('redacts a record detail before storing it', () => {
    const { store } = createTestStore();

    const entry = store.emit({
      ...ERROR_INPUT,
      detail: { status: 500, authorization: 'Bearer secret' },
    });

    expect(JSON.parse(entry.detail ?? '{}')).toEqual({
      status: 500,
      authorization: NOTIFICATION_REDACTED_PLACEHOLDER,
    });
  });

  it('stores a string detail unchanged', () => {
    const { store } = createTestStore();

    const entry = store.emit({ ...ERROR_INPUT, detail: 'HTTP 500 GET /api/api-keys' });

    expect(entry.detail).toBe('HTTP 500 GET /api/api-keys');
  });
});

describe('createNotificationStore — dedupe', () => {
  it('bumps the existing entry instead of adding a second one', () => {
    const { store, clock } = createTestStore();
    const first = store.emit(ERROR_INPUT);

    clock.advance(1_900);
    const second = store.emit(ERROR_INPUT);

    expect(second.id).toBe(first.id);
    expect(second.repeatCount).toBe(2);
    expect(store.getSnapshot().entries).toHaveLength(1);
    expect(store.getSnapshot().toasts).toEqual([first.id]);
  });

  it('creates a new entry past the window', () => {
    const { store, clock } = createTestStore();
    const first = store.emit(ERROR_INPUT);

    clock.advance(2_001);
    const second = store.emit(ERROR_INPUT);

    expect(second.id).not.toBe(first.id);
    expect(second.repeatCount).toBe(1);
    expect(store.getSnapshot().entries).toHaveLength(2);
    expect(store.getSnapshot().toasts).toEqual([second.id, first.id]);
  });

  it('treats a different message as a new entry', () => {
    const { store } = createTestStore();

    store.emit(ERROR_INPUT);
    store.emit({ ...ERROR_INPUT, message: 'Másik hiba' });

    expect(store.getSnapshot().entries).toHaveLength(2);
  });

  it('moves a bumped toast back to the front', () => {
    const { store, clock } = createTestStore();
    const first = store.emit(ERROR_INPUT);
    const other = store.emit(SUCCESS_INPUT);

    clock.advance(100);
    store.emit(ERROR_INPUT);

    expect(store.getSnapshot().toasts).toEqual([first.id, other.id]);
  });

  it('honours a custom dedupe window', () => {
    const { store, clock } = createTestStore({ dedupeWindowMs: 100 });
    store.emit(ERROR_INPUT);

    clock.advance(101);
    store.emit(ERROR_INPUT);

    expect(store.getSnapshot().entries).toHaveLength(2);
  });
});

describe('createNotificationStore — dismiss', () => {
  it('removes only the toast and keeps the log entry', () => {
    const { store } = createTestStore();
    const entry = store.emit(ERROR_INPUT);

    store.dismiss(entry.id);

    expect(store.getSnapshot().toasts).toEqual([]);
    expect(store.getSnapshot().entries).toHaveLength(1);
  });

  it('is a no-op for an unknown id', () => {
    const { store } = createTestStore();
    const listener = vi.fn();
    const before = store.getSnapshot();
    store.subscribe(listener);

    store.dismiss('does-not-exist');

    expect(store.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the remaining toasts', () => {
    const { store } = createTestStore();
    const first = store.emit(ERROR_INPUT);
    const second = store.emit(SUCCESS_INPUT);

    store.dismiss(second.id);

    expect(store.getSnapshot().toasts).toEqual([first.id]);
  });
});

describe('createNotificationStore — markAllRead', () => {
  it('marks every entry as read', () => {
    const { store } = createTestStore();
    store.emit(ERROR_INPUT);
    store.emit(SUCCESS_INPUT);

    store.markAllRead();

    expect(store.getSnapshot().entries.every((entry) => entry.read)).toBe(true);
  });

  it('does not notify twice', () => {
    const { store } = createTestStore();
    const listener = vi.fn();
    store.emit(ERROR_INPUT);
    store.subscribe(listener);

    store.markAllRead();
    const afterFirst = store.getSnapshot();
    store.markAllRead();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(afterFirst);
  });
});

describe('createNotificationStore — clear', () => {
  it('drops every entry and toast', () => {
    const { store } = createTestStore();
    store.emit(ERROR_INPUT);

    store.clear();

    expect(store.getSnapshot()).toBe(EMPTY_NOTIFICATION_STATE);
  });

  it('notifies once and stays silent afterwards', () => {
    const { store } = createTestStore();
    const listener = vi.fn();
    store.emit(ERROR_INPUT);
    store.subscribe(listener);

    store.clear();
    store.clear();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('createNotificationStore — subscribe', () => {
  it('calls every subscriber after a change', () => {
    const { store } = createTestStore();
    const first = vi.fn();
    const second = vi.fn();
    store.subscribe(first);
    store.subscribe(second);

    store.emit(ERROR_INPUT);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops calling after unsubscribe', () => {
    const { store } = createTestStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.emit(ERROR_INPUT);
    unsubscribe();
    store.emit(SUCCESS_INPUT);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('forwards a throwing subscriber and keeps the others alive', () => {
    const { store, onListenerError } = createTestStore();
    const healthy = vi.fn();
    const failure = new Error('boom');
    store.subscribe(() => {
      throw failure;
    });
    store.subscribe(healthy);

    store.emit(ERROR_INPUT);

    expect(onListenerError).toHaveBeenCalledWith(failure);
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});

describe('createNotificationStore — snapshots and caps', () => {
  it('returns a referentially stable snapshot when nothing changes', () => {
    const { store } = createTestStore();
    store.emit(ERROR_INPUT);

    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it('drops the oldest entry past the ring-buffer cap', () => {
    const { store } = createTestStore();

    emitUnique(store, NOTIFICATION_MAX_ENTRIES + 1);

    const { entries } = store.getSnapshot();
    expect(entries).toHaveLength(NOTIFICATION_MAX_ENTRIES);
    expect(entries[0]?.message).toBe(`üzenet-${NOTIFICATION_MAX_ENTRIES}`);
    expect(entries.at(-1)?.message).toBe('üzenet-1');
  });

  it('keeps only the newest toast ids at the toast cap', () => {
    const { store } = createTestStore();

    const ids = emitUnique(store, NOTIFICATION_MAX_VISIBLE_TOASTS + 1);

    const { toasts, entries } = store.getSnapshot();
    expect(toasts).toEqual(ids.slice(1).reverse());
    expect(entries).toHaveLength(NOTIFICATION_MAX_VISIBLE_TOASTS + 1);
  });

  it('honours a custom toast cap', () => {
    const { store } = createTestStore({ maxVisibleToasts: 1 });

    const ids = emitUnique(store, 2);

    expect(store.getSnapshot().toasts).toEqual([ids[1]]);
  });

  it('serves the frozen empty state as the server snapshot', () => {
    const { store } = createTestStore();
    store.emit(ERROR_INPUT);

    expect(store.getServerSnapshot()).toBe(EMPTY_NOTIFICATION_STATE);
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
    expect(Object.isFrozen(store.getServerSnapshot())).toBe(true);
  });
});

describe('createNotificationStore — structured details', () => {
  it('stores a redacted field list in the order the emitter wrote', () => {
    const { store } = createTestStore();

    const entry = store.emit({ ...ERROR_INPUT, details: createTestDetailsRecord() });

    expect(entry.details).toEqual([
      { label: 'status', value: '422' },
      { label: 'code', value: 'VALIDATION' },
      { label: 'requestId', value: 'req-1' },
    ]);
  });

  it('redacts the value of a sensitive key', () => {
    const { store } = createTestStore();

    const entry = store.emit({ ...ERROR_INPUT, details: { token: 'abc' } });

    expect(entry.details).toEqual([{ label: 'token', value: NOTIFICATION_REDACTED_PLACEHOLDER }]);
  });

  it('stores an already-built field list and keeps the mono flag', () => {
    const { store } = createTestStore();

    const entry = store.emit({
      ...ERROR_INPUT,
      details: [createTestDetailField({ label: 'requestId', mono: true })],
    });

    expect(entry.details).toEqual([{ label: 'requestId', value: 'req-1', mono: true }]);
  });

  it('leaves details undefined when none were supplied', () => {
    const { store } = createTestStore();

    expect(store.emit(ERROR_INPUT).details).toBeUndefined();
  });

  it('leaves details undefined for an empty record', () => {
    const { store } = createTestStore();

    expect(store.emit({ ...ERROR_INPUT, details: {} }).details).toBeUndefined();
  });

  it('leaves details undefined when every field was dropped', () => {
    const { store } = createTestStore();

    expect(store.emit({ ...ERROR_INPUT, details: { '   ': 'x' } }).details).toBeUndefined();
  });

  it('exposes the fields through the snapshot', () => {
    const { store } = createTestStore();

    const entry = store.emit({ ...ERROR_INPUT, details: { status: 422 } });

    expect(store.getSnapshot().entries[0]).toBe(entry);
    expect(store.getSnapshot().entries[0]?.details).toEqual([{ label: 'status', value: '422' }]);
  });

  it('replaces the details when a duplicate carries new ones', () => {
    const { store, clock } = createTestStore();
    store.emit({ ...ERROR_INPUT, details: { status: 422 } });
    clock.advance(1);

    const bumped = store.emit({ ...ERROR_INPUT, details: { status: 500 } });

    expect(bumped.repeatCount).toBe(2);
    expect(bumped.details).toEqual([{ label: 'status', value: '500' }]);
  });

  it('keeps the previous details when a duplicate carries none', () => {
    const { store, clock } = createTestStore();
    store.emit({ ...ERROR_INPUT, details: { status: 422 } });
    clock.advance(1);

    const bumped = store.emit(ERROR_INPUT);

    expect(bumped.repeatCount).toBe(2);
    expect(bumped.details).toEqual([{ label: 'status', value: '422' }]);
  });
});
