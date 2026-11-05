import { describe, expect, it } from 'vitest';
import { NOTIFICATION_REDACTED_PLACEHOLDER } from '../../src/core/notification.const.js';
import { createNotificationStore } from '../../src/core/notification.store.js';
import { createNotifier } from '../../src/react/notification.facade.js';
import type { Notifier } from '../../src/react/notification-react.interface.js';
import { REACT_FIXED_NOW } from '../mocks/react/notification-entries.fixture.js';

/**
 * Builds the facade over a fresh store with a frozen clock.
 *
 * @returns the notifier and the store it writes into.
 */
function createFacade(): { notifier: Notifier; entries: () => readonly { level: string; message: string; source: string; toast: boolean; detail?: string }[] } {
  const store = createNotificationStore({ now: () => REACT_FIXED_NOW });
  const notifier = createNotifier(store);

  return { notifier, entries: () => store.getSnapshot().entries };
}

describe('createNotifier', () => {
  it('maps every shortcut to its level', () => {
    const { notifier, entries } = createFacade();

    notifier.success('s');
    notifier.error('e');
    notifier.warning('w');
    notifier.info('i');
    notifier.system('y');

    expect(entries().map((entry) => entry.level)).toEqual([
      'system',
      'info',
      'warning',
      'error',
      'success',
    ]);
  });

  it('files entries under the manual source by default', () => {
    const { notifier, entries } = createFacade();

    notifier.info('i');

    expect(entries()[0]?.source).toBe('manual');
  });

  it('lets the caller override the source', () => {
    const { notifier, entries } = createFacade();

    notifier.error('e', { source: 'api' });

    expect(entries()[0]?.source).toBe('api');
  });

  it('toasts every level except system', () => {
    const { notifier, entries } = createFacade();

    notifier.success('s');
    notifier.system('y');

    expect(entries().map((entry) => entry.toast)).toEqual([false, true]);
  });

  it('honours an explicit toast flag over the level default', () => {
    const { notifier, entries } = createFacade();

    notifier.system('y', { toast: true });
    notifier.info('i', { toast: false });

    expect(entries().map((entry) => entry.toast)).toEqual([false, true]);
  });

  it('redacts a sensitive detail record through the store', () => {
    const { notifier, entries } = createFacade();

    notifier.error('e', { detail: { authorization: 'Bearer abc', url: '/api/keys' } });

    const detail = entries()[0]?.detail ?? '';

    expect(detail).toContain(NOTIFICATION_REDACTED_PLACEHOLDER);
    expect(detail).toContain('/api/keys');
    expect(detail).not.toContain('Bearer abc');
  });

  it('returns the stored entry, so a caller can use its id', () => {
    const { notifier } = createFacade();

    const entry = notifier.info('i');

    expect(entry.id).toMatch(/^ntf-/);
    expect(entry.repeatCount).toBe(1);
  });
});
