// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TOAST_DISMISS_LABEL } from '@callback/ui';
import { createNotificationStore } from '../../src/core/notification.store.js';
import { createNotifier } from '../../src/react/notification.facade.js';
import { NotificationHost } from '../../src/react/NotificationHost.js';
import type { Notifier } from '../../src/react/notification-react.interface.js';
import {
  createEntryList,
  REACT_FIXED_NOW,
} from '../mocks/react/notification-entries.fixture.js';
import { createNotificationWrapper } from '../mocks/react/notification-provider-harness.mock.js';
import { createRecordingStorage } from '../mocks/react/notification-storage.mock.js';

afterEach(() => {
  // RTL auto-cleanup only runs with `globals: true`; without it every render
  // would pile up in the same document and duplicate every query result.
  cleanup();
});

/**
 * Renders the host inside the real provider.
 *
 * @param options - restored entries and, optionally, an injected store.
 * @returns the notifier bound to the store the host reads.
 */
function renderHost(
  options: { readonly restored?: ReturnType<typeof createEntryList> } = {},
): { notifier: Notifier; storage: ReturnType<typeof createRecordingStorage> } {
  const storage = createRecordingStorage(options.restored ?? []);
  const store = createNotificationStore({
    now: () => REACT_FIXED_NOW,
    initialEntries: options.restored ?? [],
  });
  const Wrapper = createNotificationWrapper({
    store,
    storage,
    formatTimestamp: (epochMs) => `t:${epochMs}`,
  });

  render(
    <Wrapper>
      <NotificationHost />
    </Wrapper>,
  );

  return { notifier: createNotifier(store), storage };
}

describe('NotificationHost', () => {
  it('renders nothing but the drawer tab while the log is empty', () => {
    renderHost();

    expect(screen.queryAllByRole('status')).toHaveLength(0);
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
  });

  it('renders at most three toasts, newest first', () => {
    const { notifier } = renderHost();

    act(() => {
      notifier.info('első');
      notifier.info('második');
      notifier.info('harmadik');
      notifier.info('negyedik');
    });

    const visible = screen.getAllByRole('status');

    expect(visible).toHaveLength(3);
    expect(visible[0]).toHaveTextContent('negyedik');
    expect(screen.queryByText('első')).not.toBeInTheDocument();
  });

  it('dismisses a toast through the store and keeps the log entry', () => {
    const { notifier } = renderHost();

    act(() => {
      notifier.success('kész');
    });

    const [toast] = screen.getAllByRole('status');

    act(() => {
      within(toast as HTMLElement).getByRole('button', { name: TOAST_DISMISS_LABEL }).click();
    });

    expect(screen.queryAllByRole('status')).toHaveLength(0);

    act(() => {
      screen.getByRole('button', { expanded: false }).click();
    });

    expect(screen.getByText('kész')).toBeInTheDocument();
  });

  it('shows the restored log with the injected timestamp formatter', () => {
    renderHost({ restored: createEntryList(2) });

    act(() => {
      screen.getByRole('button', { expanded: false }).click();
    });

    const rows = screen.getAllByRole('listitem');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Üzenet 0');
    expect(rows[0]).toHaveTextContent(`t:${REACT_FIXED_NOW}`);
  });

  it('announces an error toast assertively', () => {
    const { notifier } = renderHost();

    act(() => {
      notifier.error('hiba');
    });

    expect(screen.getByRole('alert')).toHaveTextContent('hiba');
  });

  it('counts the unseen entries on the collapsed tab', () => {
    renderHost({ restored: createEntryList(2) });

    expect(screen.getByRole('button', { expanded: false })).toHaveAccessibleName(
      expect.stringContaining('2'),
    );
  });
});
