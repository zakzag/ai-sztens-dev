import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_LEVELS,
  NOTIFICATION_REDACTED_PLACEHOLDER,
  NOTIFICATION_SOURCES,
  NOTIFICATION_UNSERIALIZABLE_DETAIL,
} from '../src/core/notification.const.js';
import type { NotificationEntry } from '../src/core/notification.interface.js';
import {
  bumpEntry,
  createNotificationId,
  findDuplicate,
  markEntriesRead,
  redactRecord,
  redactValue,
  toRedactedDetail,
  trimEntries,
  trimToastIds,
} from '../src/core/notification.logic.js';
import { FIXED_NOW, createTestEntry } from './mocks/notification.fixtures.js';

const DEDUPE_WINDOW_MS = 2_000;

function createEntries(count: number): readonly NotificationEntry[] {
  return Array.from({ length: count }, (_, index) =>
    createTestEntry({ id: `entry-${index}`, createdAt: FIXED_NOW - index }),
  );
}

describe('notification vocabulary', () => {
  it('pins the five levels of the shared ToastLevel vocabulary', () => {
    expect(NOTIFICATION_LEVELS).toEqual(['success', 'error', 'warning', 'info', 'system']);
  });

  it('pins the five notification sources', () => {
    expect(NOTIFICATION_SOURCES).toEqual(['form', 'api', 'router', 'runtime', 'manual']);
  });
});

describe('createNotificationId', () => {
  it('is deterministic for the same timestamp and sequence', () => {
    expect(createNotificationId(FIXED_NOW, 1)).toBe(createNotificationId(FIXED_NOW, 1));
  });

  it('differs when the sequence advances', () => {
    expect(createNotificationId(FIXED_NOW, 2)).not.toBe(createNotificationId(FIXED_NOW, 1));
  });

  it('produces the documented id shape', () => {
    expect(createNotificationId(FIXED_NOW, 7)).toMatch(/^ntf-[0-9a-z]+-[0-9a-z]+$/);
  });
});

describe('trimEntries', () => {
  it('returns the same reference when the cap is not exceeded', () => {
    const entries = createEntries(3);

    expect(trimEntries(entries, 3)).toBe(entries);
  });

  it('keeps the newest entries and drops the oldest at the cap', () => {
    const trimmed = trimEntries(createEntries(501), 500);

    expect(trimmed).toHaveLength(500);
    expect(trimmed[0]?.id).toBe('entry-0');
    expect(trimmed.at(-1)?.id).toBe('entry-499');
  });

  it('returns an empty list when the cap is zero', () => {
    expect(trimEntries(createEntries(2), 0)).toEqual([]);
  });

  it('returns an empty list when the cap is negative', () => {
    expect(trimEntries(createEntries(2), -1)).toEqual([]);
  });
});

describe('trimToastIds', () => {
  it('returns the same reference when the cap is not exceeded', () => {
    const ids = ['a', 'b'];

    expect(trimToastIds(ids, 3)).toBe(ids);
  });

  it('drops the oldest toast id at the cap', () => {
    expect(trimToastIds(['a', 'b', 'c', 'd'], 3)).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty list when the cap is zero', () => {
    expect(trimToastIds(['a'], 0)).toEqual([]);
  });

  it('returns an empty list for an empty input', () => {
    expect(trimToastIds([], 3)).toEqual([]);
  });
});

describe('findDuplicate', () => {
  const identity = { level: 'error', message: 'Sikertelen mentés' } as const;

  it('finds the repeat just inside the window', () => {
    const entries = [createTestEntry({ ...identity, createdAt: FIXED_NOW })];

    expect(findDuplicate(entries, identity, FIXED_NOW + 1_900, DEDUPE_WINDOW_MS)).toBeDefined();
  });

  it('finds the repeat exactly on the window boundary', () => {
    const entries = [createTestEntry({ ...identity, createdAt: FIXED_NOW })];

    expect(findDuplicate(entries, identity, FIXED_NOW + 2_000, DEDUPE_WINDOW_MS)).toBeDefined();
  });

  it('does not find the repeat past the window', () => {
    const entries = [createTestEntry({ ...identity, createdAt: FIXED_NOW })];

    expect(findDuplicate(entries, identity, FIXED_NOW + 2_001, DEDUPE_WINDOW_MS)).toBeUndefined();
  });

  it('ignores an entry with a different level', () => {
    const entries = [createTestEntry({ ...identity, level: 'warning', createdAt: FIXED_NOW })];

    expect(findDuplicate(entries, identity, FIXED_NOW + 100, DEDUPE_WINDOW_MS)).toBeUndefined();
  });

  it('ignores an entry with a different message', () => {
    const entries = [createTestEntry({ ...identity, message: 'Más üzenet', createdAt: FIXED_NOW })];

    expect(findDuplicate(entries, identity, FIXED_NOW + 100, DEDUPE_WINDOW_MS)).toBeUndefined();
  });

  it('returns the newest of several matches', () => {
    const newest = createTestEntry({ ...identity, id: 'newest', createdAt: FIXED_NOW });
    const older = createTestEntry({ ...identity, id: 'older', createdAt: FIXED_NOW - 100 });

    expect(findDuplicate([newest, older], identity, FIXED_NOW, DEDUPE_WINDOW_MS)?.id).toBe('newest');
  });
});

describe('bumpEntry', () => {
  it('increments the repeat counter and refreshes the creation time', () => {
    const entry = createTestEntry({ repeatCount: 2, read: true, createdAt: FIXED_NOW });
    const bumped = bumpEntry(entry, FIXED_NOW + 500);

    expect(bumped.repeatCount).toBe(3);
    expect(bumped.createdAt).toBe(FIXED_NOW + 500);
    expect(bumped.read).toBe(false);
  });

  it('keeps every other field and does not mutate the input', () => {
    const entry = createTestEntry({ repeatCount: 1 });
    const bumped = bumpEntry(entry, FIXED_NOW + 500);

    expect(bumped.id).toBe(entry.id);
    expect(bumped.level).toBe(entry.level);
    expect(bumped.message).toBe(entry.message);
    expect(bumped.source).toBe(entry.source);
    expect(bumped.toast).toBe(entry.toast);
    expect(entry.repeatCount).toBe(1);
  });
});

describe('markEntriesRead', () => {
  it('marks every unread entry as read', () => {
    const marked = markEntriesRead([createTestEntry({ id: 'a' }), createTestEntry({ id: 'b' })]);

    expect(marked.every((entry) => entry.read)).toBe(true);
  });

  it('returns the same reference when everything is already read', () => {
    const entries = [createTestEntry({ read: true })];

    expect(markEntriesRead(entries)).toBe(entries);
  });

  it('replaces only the unread entries in a mixed list', () => {
    const read = createTestEntry({ id: 'read', read: true });
    const unread = createTestEntry({ id: 'unread', read: false });
    const marked = markEntriesRead([read, unread]);

    expect(marked[0]).toBe(read);
    expect(marked[1]).not.toBe(unread);
    expect(marked[1]?.read).toBe(true);
  });
});

describe('redactValue', () => {
  it.each([
    'authorization',
    'Authorization',
    'token',
    'X-Auth-Token',
    'password',
    'apiKey',
    'api_key',
    'secret',
    'clientSecret',
  ])('redacts the value of %s', (key) => {
    expect(redactValue(key, 'sensitive-value')).toBe(NOTIFICATION_REDACTED_PLACEHOLDER);
  });

  it.each(['message', 'status', 'url', 'requestId'])('keeps the value of %s', (key) => {
    expect(redactValue(key, 'kept')).toBe('kept');
  });

  it('keeps a non-string value of a harmless key untouched', () => {
    expect(redactValue('status', 500)).toBe(500);
  });
});

describe('redactRecord', () => {
  it('redacts only the sensitive keys', () => {
    const redacted = redactRecord({
      authorization: 'Bearer abc',
      status: 500,
      message: 'Sikertelen mentés',
    });

    expect(redacted).toEqual({
      authorization: NOTIFICATION_REDACTED_PLACEHOLDER,
      status: 500,
      message: 'Sikertelen mentés',
    });
  });

  it('does not mutate the input record', () => {
    const record = { password: 'p4ssw0rd' };

    redactRecord(record);

    expect(record.password).toBe('p4ssw0rd');
  });

  it('returns an empty record for an empty input', () => {
    expect(redactRecord({})).toEqual({});
  });
});

describe('toRedactedDetail', () => {
  it('returns undefined when no detail was supplied', () => {
    expect(toRedactedDetail(undefined)).toBeUndefined();
  });

  it('passes a string through unchanged', () => {
    expect(toRedactedDetail('HTTP 500 GET /api/api-keys')).toBe('HTTP 500 GET /api/api-keys');
  });

  it('redacts and serialises a record', () => {
    expect(toRedactedDetail({ status: 500, token: 'abc' })).toBe(
      JSON.stringify({ status: 500, token: NOTIFICATION_REDACTED_PLACEHOLDER }),
    );
  });

  it('falls back to a marker when the record cannot be serialised', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(toRedactedDetail(circular)).toBe(NOTIFICATION_UNSERIALIZABLE_DETAIL);
  });
});
