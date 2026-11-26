import { describe, expect, it } from 'vitest';

import { NOTIFICATION_STORAGE_KEY } from '../src/core/notification.const.js';
import { createNotificationStorage } from '../src/core/notification.storage.js';
import {
  createStorageWithEntries,
  createStorageWithPayload,
  createTestEntryList,
  createTestScheduler,
  createTestStorage,
} from './mocks/notification-storage.fixtures.js';

describe('createNotificationStorage — load', () => {
  it('returns an empty list for an untouched storage', () => {
    const testStorage = createTestStorage();
    const storage = createNotificationStorage({ storage: testStorage.storage });

    expect(storage.load()).toEqual([]);
  });

  it('restores what a previous adapter wrote, newest first', () => {
    const testStorage = createTestStorage();
    const scheduler = createTestScheduler();
    const entries = createTestEntryList(3);
    const first = createNotificationStorage({ storage: testStorage.storage, schedule: scheduler.schedule });

    first.save(entries);
    scheduler.runPending();

    const second = createNotificationStorage({ storage: testStorage.storage });

    expect(second.load().map((entry) => entry.id)).toEqual(['ntf-storage-0', 'ntf-storage-1', 'ntf-storage-2']);
  });

  it('removes a corrupt payload and starts empty', () => {
    const testStorage = createStorageWithPayload('{ not json');
    const storage = createNotificationStorage({ storage: testStorage.storage });

    expect(storage.load()).toEqual([]);
    expect(testStorage.counts.removeItem).toBe(1);
    expect(testStorage.peek()).toBeNull();
  });

  it('removes a foreign schema instead of guessing', () => {
    const testStorage = createStorageWithPayload({ version: 2, entries: createTestEntryList(1) });
    const storage = createNotificationStorage({ storage: testStorage.storage });

    expect(storage.load()).toEqual([]);
    expect(testStorage.counts.removeItem).toBe(1);
  });

  it('removes a payload with one broken entry', () => {
    const broken = { ...createTestEntryList(1)[0], level: 'critical' };
    const testStorage = createStorageWithPayload({ version: 1, entries: [broken] });
    const storage = createNotificationStorage({ storage: testStorage.storage });

    expect(storage.load()).toEqual([]);
    expect(testStorage.counts.removeItem).toBe(1);
  });

  it('does not try to remove anything when the key is absent', () => {
    const testStorage = createTestStorage();
    const storage = createNotificationStorage({ storage: testStorage.storage });

    storage.load();

    expect(testStorage.counts.removeItem).toBe(0);
  });

  it('degrades to an empty list when the storage throws on read', () => {
    const testStorage = createStorageWithEntries(createTestEntryList(2));

    testStorage.setReadFailure(true);

    const storage = createNotificationStorage({ storage: testStorage.storage });

    expect(storage.load()).toEqual([]);
    expect(testStorage.counts.removeItem).toBe(0);
  });

  it('trims a payload that exceeds the cap', () => {
    const testStorage = createStorageWithEntries(createTestEntryList(250));
    const storage = createNotificationStorage({ storage: testStorage.storage, cap: 200 });

    expect(storage.load()).toHaveLength(200);
  });
});

describe('createNotificationStorage — save', () => {
  it('coalesces a burst of saves into a single write with the latest payload', () => {
    const testStorage = createTestStorage();
    const scheduler = createTestScheduler();
    const storage = createNotificationStorage({ storage: testStorage.storage, schedule: scheduler.schedule });
    const entries = createTestEntryList(5);

    for (let index = 1; index <= 5; index += 1) {
      storage.save(entries.slice(0, index));
    }

    expect(scheduler.scheduleCount()).toBe(1);
    expect(scheduler.pendingCount()).toBe(1);
    expect(testStorage.counts.setItem).toBe(0);

    scheduler.runPending();

    expect(testStorage.counts.setItem).toBe(1);
    expect(JSON.parse(testStorage.peek() ?? '{}')).toMatchObject({ version: 1 });
    expect(JSON.parse(testStorage.peek() ?? '{}').entries).toHaveLength(5);
  });

  it('writes immediately on flush and cancels the scheduled tick', () => {
    const testStorage = createTestStorage();
    const scheduler = createTestScheduler();
    const storage = createNotificationStorage({ storage: testStorage.storage, schedule: scheduler.schedule });

    storage.save(createTestEntryList(2));
    storage.flush();
    scheduler.runPending();

    expect(testStorage.counts.setItem).toBe(1);
    expect(scheduler.pendingCount()).toBe(0);
  });

  it('skips a payload that is already stored', () => {
    const testStorage = createTestStorage();
    const scheduler = createTestScheduler();
    const storage = createNotificationStorage({ storage: testStorage.storage, schedule: scheduler.schedule });
    const entries = createTestEntryList(2);

    storage.save(entries);
    scheduler.runPending();
    storage.save(entries);
    scheduler.runPending();

    expect(testStorage.counts.setItem).toBe(1);
  });

  it('does not re-write the entries it just restored', () => {
    const testStorage = createStorageWithEntries(createTestEntryList(2));
    const scheduler = createTestScheduler();
    const storage = createNotificationStorage({ storage: testStorage.storage, schedule: scheduler.schedule });
    const restored = storage.load();

    storage.save(restored);
    scheduler.runPending();

    expect(scheduler.scheduleCount()).toBe(0);
    expect(testStorage.counts.setItem).toBe(0);
  });

  it('survives a failing write and retries on the next save', () => {
    const testStorage = createTestStorage();
    const scheduler = createTestScheduler();
    const storage = createNotificationStorage({ storage: testStorage.storage, schedule: scheduler.schedule });
    const entries = createTestEntryList(2);

    testStorage.setWriteFailure(true);
    storage.save(entries);
    scheduler.runPending();

    expect(testStorage.peek()).toBeNull();

    testStorage.setWriteFailure(false);
    storage.save(entries);
    scheduler.runPending();

    expect(testStorage.counts.setItem).toBe(2);
    expect(testStorage.peek()).not.toBeNull();
  });

  it('honours a custom cap', () => {
    const testStorage = createTestStorage();
    const scheduler = createTestScheduler();
    const storage = createNotificationStorage({
      storage: testStorage.storage,
      cap: 3,
      schedule: scheduler.schedule,
    });

    storage.save(createTestEntryList(5));
    scheduler.runPending();

    const stored: { entries: readonly { id: string }[] } = JSON.parse(testStorage.peek() ?? '{}');

    expect(stored.entries.map((entry) => entry.id)).toEqual(['ntf-storage-0', 'ntf-storage-1', 'ntf-storage-2']);
  });

  it('honours a custom key', () => {
    const testStorage = createTestStorage();
    const scheduler = createTestScheduler();
    const storage = createNotificationStorage({
      storage: testStorage.storage,
      key: 'aisztens.notifications.test',
      schedule: scheduler.schedule,
    });

    storage.save(createTestEntryList(1));
    scheduler.runPending();

    expect(testStorage.peek('aisztens.notifications.test')).not.toBeNull();
    expect(testStorage.peek(NOTIFICATION_STORAGE_KEY)).toBeNull();
  });
});

describe('createNotificationStorage — clear', () => {
  it('removes the key and drops a pending write', () => {
    const testStorage = createTestStorage();
    const scheduler = createTestScheduler();
    const storage = createNotificationStorage({ storage: testStorage.storage, schedule: scheduler.schedule });

    storage.save(createTestEntryList(3));
    storage.clear();
    scheduler.runPending();

    expect(testStorage.counts.removeItem).toBe(1);
    expect(testStorage.counts.setItem).toBe(0);
    expect(testStorage.peek()).toBeNull();
  });

  it('starts from a clean slate after clearing', () => {
    const testStorage = createTestStorage();
    const scheduler = createTestScheduler();
    const storage = createNotificationStorage({ storage: testStorage.storage, schedule: scheduler.schedule });

    storage.save(createTestEntryList(2));
    storage.flush();
    storage.clear();
    storage.save(createTestEntryList(2));
    scheduler.runPending();

    expect(storage.load()).toHaveLength(2);
  });
});

describe('createNotificationStorage — memory-only mode', () => {
  it.each([
    ['an omitted storage', undefined],
    ['a null storage', null],
  ])('accepts every call with %s', (_label, storageOption) => {
    const scheduler = createTestScheduler();
    const storage = createNotificationStorage({ storage: storageOption, schedule: scheduler.schedule });

    expect(() => {
      storage.save(createTestEntryList(2));
      storage.flush();
      storage.clear();
    }).not.toThrow();
    expect(storage.load()).toEqual([]);
    expect(scheduler.scheduleCount()).toBe(0);
  });
});

describe('createNotificationStorage — default scheduler', () => {
  it('still coalesces a burst into one write', async () => {
    const testStorage = createTestStorage();
    const storage = createNotificationStorage({ storage: testStorage.storage });

    storage.save(createTestEntryList(1));
    storage.save(createTestEntryList(2));

    await Promise.resolve();
    await Promise.resolve();

    expect(testStorage.counts.setItem).toBe(1);
  });
});
