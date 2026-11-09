import { describe, expect, it, vi } from 'vitest';
import type { LogDrawerSizeRange } from '@callback/ui';
import { LOG_DRAWER_WIDTH_RANGE } from '../../src/react/notification-react.const.js';
import {
  countUnseen,
  createRafScheduler,
  filterEntries,
  formatDefaultTimestamp,
  hasMoreEntries,
  parseStoredDrawerWidth,
  resolveToastTtl,
  serializeDrawerWidth,
  sliceWindow,
  toRuntimeDetail,
  toToastItems,
} from '../../src/react/notification-react.logic.js';
import type { AnimationFrameScope } from '../../src/react/notification-react.interface.js';
import { createEntry, createEntryList, REACT_FIXED_NOW } from '../mocks/react/notification-entries.fixture.js';

/** The production range, so the assertions carry the shipped numbers. */
const WIDTH_RANGE: LogDrawerSizeRange = LOG_DRAWER_WIDTH_RANGE;

describe('parseStoredDrawerWidth', () => {
  it('returns the initial width when nothing is stored', () => {
    expect(parseStoredDrawerWidth(null, WIDTH_RANGE)).toBe(
      WIDTH_RANGE.initial,
    );
  });

  it('returns the initial width for an empty payload', () => {
    expect(parseStoredDrawerWidth('', WIDTH_RANGE)).toBe(WIDTH_RANGE.initial);
    expect(parseStoredDrawerWidth('   ', WIDTH_RANGE)).toBe(WIDTH_RANGE.initial);
  });

  it('returns the initial width for a non-numeric payload', () => {
    expect(parseStoredDrawerWidth('abc', WIDTH_RANGE)).toBe(WIDTH_RANGE.initial);
    expect(parseStoredDrawerWidth('Infinity', WIDTH_RANGE)).toBe(
      WIDTH_RANGE.initial,
    );
  });

  it('reads a stored width back', () => {
    expect(parseStoredDrawerWidth('512', WIDTH_RANGE)).toBe(512);
    expect(parseStoredDrawerWidth(' 512 ', WIDTH_RANGE)).toBe(512);
  });

  it('raises a stale too-small width to the minimum', () => {
    expect(parseStoredDrawerWidth('-5', WIDTH_RANGE)).toBe(WIDTH_RANGE.min);
  });

  it('lowers a stale too-large width to the maximum', () => {
    expect(parseStoredDrawerWidth('99999', WIDTH_RANGE)).toBe(WIDTH_RANGE.max);
  });

  it('round-trips through serializeDrawerWidth', () => {
    expect(parseStoredDrawerWidth(serializeDrawerWidth(512), WIDTH_RANGE)).toBe(
      512,
    );
  });
});

describe('serializeDrawerWidth', () => {
  it('writes a plain decimal string', () => {
    expect(serializeDrawerWidth(416)).toBe('416');
  });
});

describe('resolveToastTtl', () => {
  it('gives success and info four seconds', () => {
    expect(resolveToastTtl('success')).toBe(4_000);
    expect(resolveToastTtl('info')).toBe(4_000);
  });

  it('gives warning six seconds', () => {
    expect(resolveToastTtl('warning')).toBe(6_000);
  });

  it('keeps error and system sticky', () => {
    expect(resolveToastTtl('error')).toBeNull();
    expect(resolveToastTtl('system')).toBeNull();
  });
});

describe('toToastItems', () => {
  const entries = createEntryList(3);

  it('returns an empty list when no toast is wanted', () => {
    expect(toToastItems(entries, [])).toEqual([]);
  });

  it('preserves the store order, newest first', () => {
    const items = toToastItems(entries, ['ntf-react-1', 'ntf-react-0']);

    expect(items.map((item) => item.id)).toEqual(['ntf-react-1', 'ntf-react-0']);
  });

  it('drops an id whose entry already left the ring buffer', () => {
    const items = toToastItems(entries, ['ntf-react-0', 'ntf-gone']);

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('ntf-react-0');
  });

  it('carries the detail and the repeat counter through', () => {
    const entry = createEntry({ id: 'ntf-detail', detail: 'HTTP 500', repeatCount: 3 });
    const [item] = toToastItems([entry], ['ntf-detail']);

    expect(item).toMatchObject({ detail: 'HTTP 500', repeatCount: 3, level: 'info' });
  });
});

describe('filterEntries', () => {
  it('returns the same reference for the "all" filter', () => {
    const entries = createEntryList(5);

    expect(filterEntries(entries, 'all')).toBe(entries);
  });

  it('keeps only the requested level', () => {
    const entries = [
      createEntry({ id: 'a', level: 'error' }),
      createEntry({ id: 'b', level: 'info' }),
      createEntry({ id: 'c', level: 'error' }),
    ];

    expect(filterEntries(entries, 'error').map((entry) => entry.id)).toEqual(['a', 'c']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterEntries(createEntryList(2, 'info'), 'warning')).toEqual([]);
  });
});

describe('sliceWindow', () => {
  const entries = createEntryList(70);

  it('shows the first page only', () => {
    expect(sliceWindow(entries, 20)).toHaveLength(20);
    expect(sliceWindow(entries, 20)[0]?.id).toBe('ntf-react-0');
  });

  it('returns the same reference when the window covers everything', () => {
    expect(sliceWindow(entries, 70)).toBe(entries);
    expect(sliceWindow(entries, 500)).toBe(entries);
  });

  it('returns nothing for a non-positive window', () => {
    expect(sliceWindow(entries, 0)).toEqual([]);
  });
});

describe('hasMoreEntries', () => {
  it('is true while rows remain beyond the window', () => {
    expect(hasMoreEntries(createEntryList(21), 20)).toBe(true);
  });

  it('is false when the window covers the buffer exactly', () => {
    expect(hasMoreEntries(createEntryList(20), 20)).toBe(false);
  });
});

describe('countUnseen', () => {
  it('counts the unread entries', () => {
    const entries = [
      createEntry({ id: 'a', read: false }),
      createEntry({ id: 'b', read: true }),
      createEntry({ id: 'c', read: false }),
    ];

    expect(countUnseen(entries)).toBe(2);
  });

  it('is zero for an empty log and for a fully read one', () => {
    expect(countUnseen([])).toBe(0);
    expect(countUnseen(createEntryList(3).map((entry) => ({ ...entry, read: true })))).toBe(0);
  });
});

describe('toRuntimeDetail', () => {
  it('keeps name and message but not the stack by default', () => {
    const detail = toRuntimeDetail(new TypeError('boom'), false);

    expect(detail).toEqual({ name: 'TypeError', message: 'boom' });
  });

  it('attaches the stack when details are allowed', () => {
    const error = new Error('boom');
    error.stack = 'Error: boom\n  at test';

    expect(toRuntimeDetail(error, true).stack).toBe('Error: boom\n  at test');
  });

  it('handles a thrown string', () => {
    expect(toRuntimeDetail('boom', true)).toEqual({ name: 'UnknownError', message: 'boom' });
  });

  it('stringifies a thrown non-error value', () => {
    expect(toRuntimeDetail(42, false)).toEqual({ name: 'UnknownError', message: '42' });
  });
});

describe('createRafScheduler', () => {
  it('flushes on the animation frame and cancels with its handle', () => {
    const callbacks: (() => void)[] = [];
    let cancelled: number | null = null;
    const scope: AnimationFrameScope = {
      requestAnimationFrame: (callback) => {
        callbacks.push(callback);

        return 7;
      },
      cancelAnimationFrame: (handle) => {
        cancelled = handle;
      },
    };
    const flush = vi.fn();

    const cancel = createRafScheduler(scope)(flush);

    expect(flush).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(1);

    callbacks[0]?.();
    expect(flush).toHaveBeenCalledTimes(1);

    cancel();
    expect(cancelled).toBe(7);
  });

  it('falls back to a microtask without requestAnimationFrame', async () => {
    const flush = vi.fn();

    createRafScheduler(null)(flush);
    expect(flush).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('does not flush a cancelled microtask', async () => {
    const flush = vi.fn();

    const cancel = createRafScheduler(null)(flush);
    cancel();
    await Promise.resolve();

    expect(flush).not.toHaveBeenCalled();
  });

  it('falls back when the scope only has one of the two functions', async () => {
    const flush = vi.fn();

    createRafScheduler({ requestAnimationFrame: () => 1 })(flush);
    await Promise.resolve();

    expect(flush).toHaveBeenCalledTimes(1);
  });
});

describe('formatDefaultTimestamp', () => {
  it('renders a non-empty time string', () => {
    expect(formatDefaultTimestamp(REACT_FIXED_NOW)).toMatch(/\d{1,2}:\d{2}/);
  });

  it('formats a different instant differently', () => {
    expect(formatDefaultTimestamp(REACT_FIXED_NOW)).not.toBe(
      formatDefaultTimestamp(REACT_FIXED_NOW + 3_600_000),
    );
  });
});
