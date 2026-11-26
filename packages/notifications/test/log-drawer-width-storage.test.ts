import { describe, expect, it } from 'vitest';
import { createLogDrawerWidthStorage } from '../src/react/log-drawer-width.storage.js';
import { LOG_DRAWER_WIDTH_STORAGE_KEY } from '../src/react/notification-react.const.js';
import { createTestStorage } from './mocks/notification-storage.fixtures.js';

describe('createLogDrawerWidthStorage', () => {
  it('round-trips a width through the storage', () => {
    const { storage } = createTestStorage();
    const widthStorage = createLogDrawerWidthStorage({ storage });

    widthStorage.save(512);

    expect(widthStorage.load()).toBe('512');
  });

  it('writes under the versioned default key', () => {
    const test = createTestStorage();
    const widthStorage = createLogDrawerWidthStorage({ storage: test.storage });

    widthStorage.save(480);

    expect(test.peek(LOG_DRAWER_WIDTH_STORAGE_KEY)).toBe('480');
  });

  it('honours an injected key', () => {
    const test = createTestStorage();
    const widthStorage = createLogDrawerWidthStorage({
      storage: test.storage,
      key: 'custom.width',
    });

    widthStorage.save(360);

    expect(test.peek('custom.width')).toBe('360');
    expect(test.peek(LOG_DRAWER_WIDTH_STORAGE_KEY)).toBeNull();
  });

  it('returns null when nothing is stored yet', () => {
    const { storage } = createTestStorage();

    expect(createLogDrawerWidthStorage({ storage }).load()).toBeNull();
  });

  it('returns null when the storage throws on read', () => {
    const test = createTestStorage();

    test.seed('512', LOG_DRAWER_WIDTH_STORAGE_KEY);
    test.setReadFailure(true);

    expect(
      createLogDrawerWidthStorage({ storage: test.storage }).load(),
    ).toBeNull();
  });

  it('does not throw and stores nothing when the write is rejected', () => {
    const test = createTestStorage();
    const widthStorage = createLogDrawerWidthStorage({ storage: test.storage });

    test.setWriteFailure(true);

    expect(() => widthStorage.save(512)).not.toThrow();
    expect(test.peek(LOG_DRAWER_WIDTH_STORAGE_KEY)).toBeNull();
  });

  it('is a no-op without a storage', () => {
    const widthStorage = createLogDrawerWidthStorage();

    expect(widthStorage.load()).toBeNull();
    expect(() => widthStorage.save(512)).not.toThrow();
  });

  it('treats an explicit null storage as memory-only', () => {
    const widthStorage = createLogDrawerWidthStorage({ storage: null });

    expect(widthStorage.load()).toBeNull();
    expect(() => widthStorage.save(512)).not.toThrow();
  });
});
