// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogLevelFilter } from '@callback/ui';
import {
  LOG_DRAWER_WIDTH_RANGE,
  RUNTIME_ERROR_MESSAGE,
} from '../../src/react/notification-react.const.js';
import { useNotifier } from '../../src/react/notification.facade.js';
import {
  useLogDrawer,
  useLogEntries,
  useToastTimers,
  useToasts,
} from '../../src/react/use-notifications.js';
import {
  createEntry,
  createEntryList,
} from '../mocks/react/notification-entries.fixture.js';
import {
  createNotificationWrapper,
} from '../mocks/react/notification-provider-harness.mock.js';
import { createRecordingStorage } from '../mocks/react/notification-storage.mock.js';
import { createRecordingWidthStorage } from '../mocks/react/log-drawer-width-storage.mock.js';
import {
  dispatchUnhandledRejection,
  dispatchWindowError,
} from '../mocks/react/notification-events.mock.js';
import {
  dispatchVisibilityChange,
  setDocumentHidden,
} from '../mocks/react/document-visibility.mock.js';

/**
 * The surface a page or the host composes, in one hook call.
 *
 * `useLogEntries` needs the controller the caller owns, so both are built
 * together — exactly like `NotificationHost` does it.
 */
function useDrawerSurface() {
  const controller = useLogDrawer();

  return {
    notify: useNotifier(),
    toasts: useToasts(),
    controller,
    entries: useLogEntries(controller),
  };
}

/** The timer surface: visible toasts plus their pause/resume controls. */
function useTimerSurface() {
  const toasts = useToasts();

  return { notify: useNotifier(), toasts, timers: useToastTimers(toasts) };
}

afterEach(() => {
  setDocumentHidden(false);
});

describe('NotificationProvider restore', () => {
  it('reads the mirror exactly once and shows the restored log on the first render', () => {
    const storage = createRecordingStorage(createEntryList(3));
    const wrapper = createNotificationWrapper({ storage });

    const { result } = renderHook(useDrawerSurface, { wrapper });

    expect(storage.loadCount()).toBe(1);
    expect(result.current.entries.map((entry) => entry.id)).toEqual([
      'ntf-react-0',
      'ntf-react-1',
      'ntf-react-2',
    ]);
  });

  it('never restores toasts, only the log', () => {
    const storage = createRecordingStorage(createEntryList(2));
    const wrapper = createNotificationWrapper({ storage });

    const { result } = renderHook(useDrawerSurface, { wrapper });

    expect(result.current.toasts).toEqual([]);
  });

  it('uses the injected store instead of creating one', () => {
    const storage = createRecordingStorage(createEntryList(1));
    const wrapper = createNotificationWrapper({ storage });

    const { result } = renderHook(useDrawerSurface, { wrapper });

    expect(result.current.entries).toHaveLength(1);
    expect(storage.saveCount()).toBe(0);
  });
});

describe('useToasts', () => {
  it('returns the newest toast first and refreshes on every emit', () => {
    const wrapper = createNotificationWrapper({ storage: createRecordingStorage() });

    const { result } = renderHook(useDrawerSurface, { wrapper });

    act(() => {
      result.current.notify.info('első');
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.notify.info('második');
    });

    expect(result.current.toasts.map((toast) => toast.message)).toEqual(['második', 'első']);
  });

  it('logs a system entry without showing a toast', () => {
    const wrapper = createNotificationWrapper({ storage: createRecordingStorage() });

    const { result } = renderHook(useDrawerSurface, { wrapper });

    act(() => {
      result.current.notify.system('rendszerüzenet');
    });

    expect(result.current.toasts).toEqual([]);
    expect(result.current.entries).toHaveLength(1);
  });

  it('keeps the newest three toasts only', () => {
    const wrapper = createNotificationWrapper({ storage: createRecordingStorage() });

    const { result } = renderHook(useDrawerSurface, { wrapper });

    act(() => {
      result.current.notify.info('1');
      result.current.notify.info('2');
      result.current.notify.info('3');
      result.current.notify.info('4');
    });

    // The store caps the toast ids, so the host never renders an endless stack.
    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts[0]?.message).toBe('4');
  });
});

describe('useLogDrawer and useLogEntries', () => {
  it('pages 20 → 70 and stops when nothing remains', () => {
    const storage = createRecordingStorage(createEntryList(70));
    const wrapper = createNotificationWrapper({ storage });

    const { result } = renderHook(useDrawerSurface, { wrapper });

    expect(result.current.entries).toHaveLength(20);
    expect(result.current.controller.visibleCount).toBe(20);
    expect(result.current.controller.hasMore).toBe(true);

    act(() => {
      result.current.controller.loadMore();
    });

    expect(result.current.entries).toHaveLength(70);
    expect(result.current.controller.hasMore).toBe(false);
  });

  it('filters the rows and resets the window on a filter change', () => {
    const entries = [
      ...createEntryList(30),
      createEntry({ id: 'ntf-error-1', level: 'error', message: 'Hiba 1' }),
      createEntry({ id: 'ntf-error-2', level: 'error', message: 'Hiba 2' }),
    ];
    const wrapper = createNotificationWrapper({
      storage: createRecordingStorage(entries),
    });

    const { result } = renderHook(useDrawerSurface, { wrapper });

    act(() => {
      result.current.controller.loadMore();
    });
    expect(result.current.controller.visibleCount).toBe(70);

    act(() => {
      result.current.controller.setLevelFilter('error' satisfies LogLevelFilter);
    });

    // The store keeps the order it was given, so the two errors stay in
    // restore order — the filter narrows, it does not sort.
    expect(result.current.entries.map((entry) => entry.id)).toEqual([
      'ntf-error-1',
      'ntf-error-2',
    ]);
    expect(result.current.controller.visibleCount).toBe(20);
    expect(result.current.controller.hasMore).toBe(false);
  });

  it('marks every entry read when the drawer opens, and only then', () => {
    const wrapper = createNotificationWrapper({
      storage: createRecordingStorage(createEntryList(2)),
    });

    const { result } = renderHook(useDrawerSurface, { wrapper });

    expect(result.current.controller.unseenCount).toBe(2);

    act(() => {
      result.current.controller.toggle();
    });

    expect(result.current.controller.isOpen).toBe(true);
    expect(result.current.controller.unseenCount).toBe(0);
  });

  it('clears both the store and the mirror', () => {
    const storage = createRecordingStorage(createEntryList(5));
    const wrapper = createNotificationWrapper({ storage });

    const { result } = renderHook(useDrawerSurface, { wrapper });

    act(() => {
      result.current.controller.clear();
    });

    expect(result.current.entries).toEqual([]);
    expect(storage.clearCount()).toBe(1);
  });
});

describe('drawer width', () => {
  /**
   * Renders the drawer surface over a recording width storage.
   *
   * @param stored - raw payload the width storage hands back.
   * @returns the hook result and the width storage.
   */
  function renderWidth(stored: string | null = null) {
    const widthStorage = createRecordingWidthStorage(stored);
    const wrapper = createNotificationWrapper({
      storage: createRecordingStorage(),
      widthStorage,
    });

    return { widthStorage, ...renderHook(useDrawerSurface, { wrapper }) };
  }

  it('restores the width read exactly once from the injected storage', () => {
    const { result, widthStorage } = renderWidth('512');

    expect(result.current.controller.width).toBe(512);
    expect(widthStorage.loadCount()).toBe(1);
    expect(widthStorage.savedWidths()).toEqual([512]);
  });

  it('falls back to the default width when nothing is stored', () => {
    const { result } = renderWidth();

    expect(result.current.controller.width).toBe(
      LOG_DRAWER_WIDTH_RANGE.initial,
    );
  });

  it('falls back to the default width for a corrupt payload', () => {
    const { result } = renderWidth('abc');

    expect(result.current.controller.width).toBe(
      LOG_DRAWER_WIDTH_RANGE.initial,
    );
  });

  it('clamps a stale stored width into the range', () => {
    expect(renderWidth('99999').result.current.controller.width).toBe(
      LOG_DRAWER_WIDTH_RANGE.max,
    );
    expect(renderWidth('-5').result.current.controller.width).toBe(
      LOG_DRAWER_WIDTH_RANGE.min,
    );
  });

  it('clamps every width it is given', () => {
    const { result } = renderWidth();

    act(() => {
      result.current.controller.updateWidth(10);
    });
    expect(result.current.controller.width).toBe(LOG_DRAWER_WIDTH_RANGE.min);

    act(() => {
      result.current.controller.updateWidth(5_000);
    });
    expect(result.current.controller.width).toBe(LOG_DRAWER_WIDTH_RANGE.max);
  });

  it('writes nothing per pointer move and persists once when the drag ends', () => {
    const { result, widthStorage } = renderWidth();

    act(() => {
      result.current.controller.beginResize();
    });
    expect(result.current.controller.isResizing).toBe(true);

    act(() => {
      result.current.controller.updateWidth(480);
    });
    act(() => {
      result.current.controller.updateWidth(520);
    });

    // Only the mount write happened so far: a drag must not burn an
    // `setItem` per `pointermove` (AIS-150 D5).
    expect(widthStorage.saveCount()).toBe(1);

    act(() => {
      result.current.controller.endResize();
    });

    expect(result.current.controller.isResizing).toBe(false);
    expect(widthStorage.lastSaved()).toBe(520);
    expect(widthStorage.saveCount()).toBe(2);
  });

  it('persists a keyboard change immediately', () => {
    const { result, widthStorage } = renderWidth();

    act(() => {
      result.current.controller.updateWidth(600);
    });

    expect(widthStorage.lastSaved()).toBe(600);
  });

  it('resets to the default width and persists it', () => {
    const { result, widthStorage } = renderWidth('640');

    act(() => {
      result.current.controller.resetWidth();
    });

    expect(result.current.controller.width).toBe(
      LOG_DRAWER_WIDTH_RANGE.initial,
    );
    expect(widthStorage.lastSaved()).toBe(LOG_DRAWER_WIDTH_RANGE.initial);
  });

  it('exposes the range the handle has to clamp to', () => {
    const { result } = renderWidth();

    expect(result.current.controller.widthRange).toEqual(LOG_DRAWER_WIDTH_RANGE);
  });

  it('writes nothing more after unmount', () => {
    const { widthStorage, unmount } = renderWidth();

    const beforeUnmount = widthStorage.saveCount();

    unmount();

    expect(widthStorage.saveCount()).toBe(beforeUnmount);
  });
});

describe('toast timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dismisses a success toast after four seconds', () => {
    const wrapper = createNotificationWrapper({ storage: createRecordingStorage() });
    const { result } = renderHook(useTimerSurface, { wrapper });

    act(() => {
      result.current.notify.success('siker');
    });

    act(() => {
      vi.advanceTimersByTime(3_999);
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('keeps a warning toast for six seconds', () => {
    const wrapper = createNotificationWrapper({ storage: createRecordingStorage() });
    const { result } = renderHook(useTimerSurface, { wrapper });

    act(() => {
      result.current.notify.warning('figyelem');
    });

    act(() => {
      vi.advanceTimersByTime(5_999);
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('never dismisses an error toast on its own', () => {
    const wrapper = createNotificationWrapper({ storage: createRecordingStorage() });
    const { result } = renderHook(useTimerSurface, { wrapper });

    act(() => {
      result.current.notify.error('hiba');
    });

    act(() => {
      vi.advanceTimersByTime(600_000);
    });

    expect(result.current.toasts).toHaveLength(1);
  });

  it('stops the countdown while paused and restarts a full TTL on resume', () => {
    const wrapper = createNotificationWrapper({ storage: createRecordingStorage() });
    const { result } = renderHook(useTimerSurface, { wrapper });

    act(() => {
      result.current.notify.info('olvasom');
    });

    const id = result.current.toasts[0]?.id ?? '';

    act(() => {
      result.current.timers.pause(id);
    });
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.timers.resume(id);
    });
    act(() => {
      vi.advanceTimersByTime(3_999);
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('pauses every timer while the document is hidden and resumes when visible', () => {
    const wrapper = createNotificationWrapper({ storage: createRecordingStorage() });
    const { result } = renderHook(useTimerSurface, { wrapper });

    act(() => {
      result.current.notify.info('háttérben');
    });

    setDocumentHidden(true);
    act(() => {
      dispatchVisibilityChange();
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.toasts).toHaveLength(1);

    setDocumentHidden(false);
    act(() => {
      dispatchVisibilityChange();
    });
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('clears every timer on unmount', () => {
    const wrapper = createNotificationWrapper({ storage: createRecordingStorage() });
    const { result, unmount } = renderHook(useTimerSurface, { wrapper });

    act(() => {
      result.current.notify.success('siker');
      result.current.notify.warning('figyelem');
    });

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('global capture', () => {
  it('records an uncaught error as a runtime entry without a stack by default', () => {
    const wrapper = createNotificationWrapper({ storage: createRecordingStorage() });
    const { result } = renderHook(useDrawerSurface, { wrapper });

    act(() => {
      dispatchWindowError(new TypeError('boom'));
    });

    const [entry] = result.current.entries;

    expect(entry?.level).toBe('error');
    expect(entry?.source).toBe('runtime');
    expect(entry?.message).toBe(RUNTIME_ERROR_MESSAGE);
    expect(entry?.detail).toContain('TypeError');
    expect(JSON.parse(entry?.detail ?? '{}')).not.toHaveProperty('stack');
  });

  it('records the stack when includeDetails is true', () => {
    const wrapper = createNotificationWrapper({
      storage: createRecordingStorage(),
      includeDetails: true,
    });
    const { result } = renderHook(useDrawerSurface, { wrapper });

    act(() => {
      dispatchWindowError(new Error('boom'));
    });

    expect(JSON.parse(result.current.entries[0]?.detail ?? '{}')).toHaveProperty('stack');
  });

  it('records an unhandled rejection', () => {
    const wrapper = createNotificationWrapper({ storage: createRecordingStorage() });
    const { result } = renderHook(useDrawerSurface, { wrapper });

    act(() => {
      dispatchUnhandledRejection(new Error('rejected'));
    });

    const [entry] = result.current.entries;

    expect(entry?.source).toBe('runtime');
    expect(entry?.detail).toContain('rejected');
  });

  it('removes both listeners on unmount', () => {
    const storage = createRecordingStorage();
    const wrapper = createNotificationWrapper({ storage });
    const { result, unmount } = renderHook(useDrawerSurface, { wrapper });

    unmount();
    dispatchWindowError(new Error('after unmount'));
    dispatchUnhandledRejection(new Error('after unmount'));

    // No listener is left: nothing was emitted, so nothing could be saved either.
    expect(storage.saveCount()).toBe(0);
    expect(result.current.entries).toEqual([]);
  });
});

describe('mirror writes', () => {
  it('saves on every store change and flushes on pagehide', () => {
    const storage = createRecordingStorage();
    const wrapper = createNotificationWrapper({ storage });
    const { result } = renderHook(useDrawerSurface, { wrapper });

    act(() => {
      result.current.notify.info('mentés');
    });

    expect(storage.saveCount()).toBe(1);
    expect(storage.lastSaved()?.[0]?.message).toBe('mentés');

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(storage.flushCount()).toBe(1);
  });

  it('flushes once more on unmount', () => {
    const storage = createRecordingStorage();
    const wrapper = createNotificationWrapper({ storage });
    const { unmount } = renderHook(useDrawerSurface, { wrapper });

    unmount();

    expect(storage.flushCount()).toBe(1);
  });
});
