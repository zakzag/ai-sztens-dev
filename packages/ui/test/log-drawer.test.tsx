import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LogDrawer } from '../src/components/log-drawer/LogDrawer.js';
import {
  LOG_DRAWER_CLEAR_LABEL,
  LOG_DRAWER_CLOSE_LABEL,
  LOG_DRAWER_EMPTY_LABEL,
  LOG_DRAWER_FILTER_GROUP_LABEL,
  LOG_DRAWER_LOAD_MORE_LABEL,
  LOG_DRAWER_TITLE,
  LOG_FILTERS,
  LOG_FILTER_LABELS,
} from '../src/components/log-drawer/log-drawer.const.js';
import { toLogDrawerTabLabel } from '../src/components/log-drawer/log-drawer.logic.js';
import type { LogDrawerProps } from '../src/components/log-drawer/log-drawer.interface.js';
import {
  LOG_ENTRY_BASE_TIMESTAMP,
  buildLogEntries,
  stubFormatTimestamp,
} from './mocks/log-entries.mock.js';

function buildProps(overrides: Partial<LogDrawerProps> = {}): LogDrawerProps {
  return {
    entries: buildLogEntries(2),
    isOpen: false,
    unseenCount: 0,
    levelFilter: 'all',
    hasMore: true,
    onToggle: vi.fn(),
    onClose: vi.fn(),
    onFilterChange: vi.fn(),
    onLoadMore: vi.fn(),
    onClear: vi.fn(),
    formatTimestamp: stubFormatTimestamp,
    ...overrides,
  };
}

function renderOpen(overrides: Partial<LogDrawerProps> = {}) {
  const props = buildProps({ isOpen: true, ...overrides });

  render(<LogDrawer {...props} />);

  return props;
}

describe('LogDrawer', () => {
  it('renders only the tab while closed', () => {
    render(<LogDrawer {...buildProps()} />);

    const tab = screen.getByRole('button', { name: toLogDrawerTabLabel(0) });

    expect(tab).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.queryByText('Bejegyzés 1')).not.toBeInTheDocument();
  });

  it('points the closed tab at an existing panel element', () => {
    render(<LogDrawer {...buildProps()} />);

    const tab = screen.getByRole('button', { name: toLogDrawerTabLabel(0) });
    const panelId = tab.getAttribute('aria-controls');

    expect(panelId).not.toBeNull();
    expect(document.getElementById(String(panelId))).not.toBeNull();
  });

  it('shows the unseen count in the label and as a badge', () => {
    render(<LogDrawer {...buildProps({ unseenCount: 3 })} />);

    const tab = screen.getByRole('button', { name: toLogDrawerTabLabel(3) });

    expect(tab).toHaveTextContent('3');
    expect(toLogDrawerTabLabel(3)).toBe(
      `${toLogDrawerTabLabel(0)} (3 új)`,
    );
  });

  it('hides the badge when there is no unseen entry', () => {
    render(<LogDrawer {...buildProps({ unseenCount: 0 })} />);

    const tab = screen.getByRole('button', { name: toLogDrawerTabLabel(0) });

    expect(tab).not.toHaveTextContent('0');
  });

  it('reports the toggle intent from the tab', async () => {
    const props = buildProps();

    render(<LogDrawer {...props} />);
    await userEvent.click(
      screen.getByRole('button', { name: toLogDrawerTabLabel(0) }),
    );

    expect(props.onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders the entries newest first and the total count', () => {
    renderOpen();

    const rows = screen.getAllByRole('listitem');

    expect(rows[0]).toHaveTextContent('Bejegyzés 1');
    expect(rows[1]).toHaveTextContent('Bejegyzés 2');
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('formats every row timestamp with the injected formatter', () => {
    const formatTimestamp = vi.fn(stubFormatTimestamp);

    renderOpen({ formatTimestamp });

    expect(formatTimestamp).toHaveBeenCalledTimes(2);
    expect(formatTimestamp).toHaveBeenNthCalledWith(1, LOG_ENTRY_BASE_TIMESTAMP);
    expect(formatTimestamp).toHaveBeenNthCalledWith(
      2,
      LOG_ENTRY_BASE_TIMESTAMP + 1,
    );
  });

  it('renders the empty state when there are no entries', () => {
    renderOpen({ entries: [] });

    expect(screen.getByText(LOG_DRAWER_EMPTY_LABEL)).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('asks for older entries exactly once per activation', async () => {
    const props = renderOpen();

    await userEvent.click(
      screen.getByRole('button', { name: LOG_DRAWER_LOAD_MORE_LABEL }),
    );

    expect(props.onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('disables the load-more control when the buffer is exhausted', () => {
    renderOpen({ hasMore: false });

    expect(
      screen.getByRole('button', { name: LOG_DRAWER_LOAD_MORE_LABEL }),
    ).toBeDisabled();
  });

  it('renders every filter chip and reports the chosen value', async () => {
    const props = renderOpen();

    const group = screen.getByRole('group', {
      name: LOG_DRAWER_FILTER_GROUP_LABEL,
    });

    expect(group).toBeInTheDocument();
    expect(within(group).getAllByRole('button')).toHaveLength(
      LOG_FILTERS.length,
    );

    await userEvent.click(
      screen.getByRole('button', { name: LOG_FILTER_LABELS.error }),
    );

    expect(props.onFilterChange).toHaveBeenCalledTimes(1);
    expect(props.onFilterChange).toHaveBeenCalledWith('error');
  });

  it('marks the active filter chip as pressed', () => {
    renderOpen({ levelFilter: 'success' });

    expect(
      screen.getByRole('button', { name: LOG_FILTER_LABELS.success }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: LOG_FILTER_LABELS.all }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('closes on Escape while open', async () => {
    const props = renderOpen();

    await userEvent.keyboard('{Escape}');

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape while closed', async () => {
    const props = buildProps();

    render(<LogDrawer {...props} />);
    await userEvent.keyboard('{Escape}');

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('reports the clear intent from the header', async () => {
    const props = renderOpen();

    await userEvent.click(
      screen.getByRole('button', { name: LOG_DRAWER_CLEAR_LABEL }),
    );

    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('reports the close intent from the header control', async () => {
    const props = renderOpen();

    await userEvent.click(
      screen.getByRole('button', { name: LOG_DRAWER_CLOSE_LABEL }),
    );

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('is a named log region with live announcements switched off', () => {
    renderOpen();

    const panel = screen.getByRole('log', { name: LOG_DRAWER_TITLE });

    expect(panel).toHaveAttribute('aria-live', 'off');
  });
});
