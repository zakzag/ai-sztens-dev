import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LogDrawer } from '../src/components/log-drawer/LogDrawer.js';
import {
  LOG_DRAWER_CLEAR_LABEL,
  LOG_DRAWER_CLOSE_LABEL,
  LOG_DRAWER_EMPTY_LABEL,
  LOG_DRAWER_FILTER_GROUP_LABEL,
  LOG_DRAWER_HANDLE_COLLAPSED_GLYPH,
  LOG_DRAWER_HANDLE_OPEN_GLYPH,
  LOG_DRAWER_HEADER_CLOSE_LABEL,
  LOG_DRAWER_LOAD_MORE_LABEL,
  LOG_DRAWER_OPEN_LABEL,
  LOG_DRAWER_RESIZE_HANDLE_LABEL,
  LOG_DRAWER_TITLE,
  LOG_DRAWER_WIDTH_CSS_VAR,
  LOG_DRAWER_WIDTH_DEFAULT,
  LOG_DRAWER_WIDTH_MAX,
  LOG_DRAWER_WIDTH_MIN,
  LOG_DRAWER_WIDTH_STEP,
  LOG_DRAWER_WIDTH_STEP_LARGE,
  LOG_FILTERS,
  LOG_FILTER_LABELS,
} from '../src/components/log-drawer/log-drawer.const.js';
import { toLogDrawerHandleLabel } from '../src/components/log-drawer/log-drawer.logic.js';
import type {
  LogDrawerProps,
  LogDrawerSizeRange,
} from '../src/components/log-drawer/log-drawer.interface.js';
import {
  LOG_ENTRY_BASE_TIMESTAMP,
  buildLogEntries,
  stubFormatTimestamp,
} from './mocks/log-entries.mock.js';
import {
  dispatchPointerEvent,
  stubPointerCapture,
} from './mocks/pointer-capture.mock.js';

/** The production range, so the assertions carry the shipped numbers. */
const WIDTH_RANGE: LogDrawerSizeRange = {
  min: LOG_DRAWER_WIDTH_MIN,
  max: LOG_DRAWER_WIDTH_MAX,
  initial: LOG_DRAWER_WIDTH_DEFAULT,
};

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
    width: LOG_DRAWER_WIDTH_DEFAULT,
    widthRange: WIDTH_RANGE,
    isResizing: false,
    onWidthChange: vi.fn(),
    onResizeStart: vi.fn(),
    onResizeEnd: vi.fn(),
    onWidthReset: vi.fn(),
    ...overrides,
  };
}

function renderOpen(overrides: Partial<LogDrawerProps> = {}) {
  const props = buildProps({ isOpen: true, ...overrides });

  render(<LogDrawer {...props} />);

  return props;
}

/**
 * @param isOpen - state the handle is queried in.
 * @param unseenCount - unseen count the name is built from.
 * @returns the single toggle handle of the component.
 */
function getHandle(isOpen: boolean, unseenCount = 0): HTMLElement {
  return screen.getByRole('button', {
    name: toLogDrawerHandleLabel(unseenCount, isOpen),
  });
}

describe('toLogDrawerHandleLabel', () => {
  it('names the open action while the panel is collapsed', () => {
    expect(toLogDrawerHandleLabel(0, false)).toBe(LOG_DRAWER_OPEN_LABEL);
  });

  it('names the close action while the panel is open', () => {
    expect(toLogDrawerHandleLabel(0, true)).toBe(LOG_DRAWER_CLOSE_LABEL);
  });

  it('appends the unseen count in both states', () => {
    expect(toLogDrawerHandleLabel(3, false)).toBe(
      `${LOG_DRAWER_OPEN_LABEL} (3 új)`,
    );
    expect(toLogDrawerHandleLabel(3, true)).toBe(
      `${LOG_DRAWER_CLOSE_LABEL} (3 új)`,
    );
  });

  it('ignores a negative count', () => {
    expect(toLogDrawerHandleLabel(-1, false)).toBe(LOG_DRAWER_OPEN_LABEL);
  });
});

describe('LogDrawer — the persistent handle', () => {
  it('renders the toggle handle while the panel is collapsed', () => {
    render(<LogDrawer {...buildProps()} />);

    expect(getHandle(false)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.queryByText('Bejegyzés 1')).not.toBeInTheDocument();
  });

  it('renders the toggle handle while the panel is open', () => {
    renderOpen();

    expect(getHandle(true)).toHaveAttribute('aria-expanded', 'true');
  });

  it('flips the chevron and the accessible name with the state', () => {
    const collapsed = buildProps();

    const { unmount } = render(<LogDrawer {...collapsed} />);
    const closedHandle = getHandle(false);

    expect(closedHandle).toHaveTextContent(LOG_DRAWER_HANDLE_COLLAPSED_GLYPH);
    expect(closedHandle).not.toHaveTextContent(LOG_DRAWER_HANDLE_OPEN_GLYPH);
    unmount();

    renderOpen();
    const openHandle = getHandle(true);

    expect(openHandle).toHaveTextContent(LOG_DRAWER_HANDLE_OPEN_GLYPH);
    expect(openHandle).not.toHaveTextContent(LOG_DRAWER_HANDLE_COLLAPSED_GLYPH);
  });

  it('exposes aria-expanded and aria-controls on the handle in both states', () => {
    const collapsed = buildProps();

    const { unmount } = render(<LogDrawer {...collapsed} />);
    const closedHandle = getHandle(false);
    const closedPanelId = closedHandle.getAttribute('aria-controls');

    expect(closedPanelId).not.toBeNull();
    expect(document.getElementById(String(closedPanelId))).not.toBeNull();
    unmount();

    renderOpen();
    const openHandle = getHandle(true);
    const openPanelId = openHandle.getAttribute('aria-controls');

    expect(openPanelId).not.toBeNull();
    expect(document.getElementById(String(openPanelId))).not.toBeNull();
  });

  it('calls onToggle when the handle is activated while collapsed', async () => {
    const props = buildProps();

    render(<LogDrawer {...props} />);
    await userEvent.click(getHandle(false));

    expect(props.onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onToggle when the handle is activated while open', async () => {
    const props = renderOpen();

    await userEvent.click(getHandle(true));

    expect(props.onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the unseen badge in both states and hides it at zero', () => {
    const collapsed = buildProps({ unseenCount: 3 });

    const { unmount } = render(<LogDrawer {...collapsed} />);

    expect(getHandle(false, 3)).toHaveTextContent('3');
    unmount();

    renderOpen({ unseenCount: 3 });

    expect(getHandle(true, 3)).toHaveTextContent('3');
  });

  it('hides the badge and the count suffix when nothing is unseen', () => {
    const props = buildProps({ unseenCount: 0 });

    render(<LogDrawer {...props} />);

    const handle = getHandle(false, 0);

    expect(handle).not.toHaveTextContent('0');
    expect(handle).toHaveAccessibleName(LOG_DRAWER_OPEN_LABEL);
  });

  it('keeps the header close button and Escape as close paths', async () => {
    const props = renderOpen();

    await userEvent.click(
      screen.getByRole('button', { name: LOG_DRAWER_HEADER_CLOSE_LABEL }),
    );

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onToggle).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');

    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('ignores Escape while closed', async () => {
    const props = buildProps();

    render(<LogDrawer {...props} />);
    await userEvent.keyboard('{Escape}');

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('keeps the panel non-modal and aria-hidden while collapsed', () => {
    render(<LogDrawer {...buildProps()} />);

    const panel = document.getElementById(
      String(getHandle(false).getAttribute('aria-controls')),
    );

    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(panel?.className).toContain('pointer-events-none');
    expect(panel?.className).toContain('translate-x-full');
  });
});

describe('LogDrawer — content', () => {
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

  it('reports the clear intent from the header', async () => {
    const props = renderOpen();

    await userEvent.click(
      screen.getByRole('button', { name: LOG_DRAWER_CLEAR_LABEL }),
    );

    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('is a named log region with live announcements switched off', () => {
    renderOpen();

    const panel = screen.getByRole('log', { name: LOG_DRAWER_TITLE });

    expect(panel).toHaveAttribute('aria-live', 'off');
  });
});

describe('LogDrawer — resizable panel', () => {
  /**
   * Renders the open panel and installs the pointer-capture stubs.
   *
   * @param overrides - props to replace on the defaults.
   * @returns the props, the separator element and its capture spies.
   */
  function renderResizable(overrides: Partial<LogDrawerProps> = {}) {
    const props = renderOpen(overrides);
    const handle = screen.getByRole('separator', {
      name: LOG_DRAWER_RESIZE_HANDLE_LABEL,
    });

    return { props, handle, stubs: stubPointerCapture(handle) };
  }

  /**
   * @returns the panel element of the open drawer.
   */
  function getPanel(): HTMLElement {
    return screen.getByRole('log', { name: LOG_DRAWER_TITLE });
  }

  it('exposes the separator semantics and the current value', () => {
    const { handle } = renderResizable({ width: 480 });

    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('aria-valuenow', '480');
    expect(handle).toHaveAttribute('aria-valuemin', String(LOG_DRAWER_WIDTH_MIN));
    expect(handle).toHaveAttribute('aria-valuemax', String(LOG_DRAWER_WIDTH_MAX));
    expect(handle).toHaveAttribute('tabindex', '0');
  });

  it('is hidden below md so a full-width panel has nothing to drag', () => {
    const { handle } = renderResizable();

    expect(handle.className).toContain('hidden');
    expect(handle.className).toContain('md:flex');
  });

  it('ignores a pointer that only hovers the separator', () => {
    const { props, handle } = renderResizable();

    dispatchPointerEvent(handle, 'pointermove', { pointerId: 1, clientX: 600 });
    dispatchPointerEvent(handle, 'pointermove', { pointerId: 1, clientX: 550 });

    expect(props.onResizeStart).not.toHaveBeenCalled();
    expect(props.onWidthChange).not.toHaveBeenCalled();
  });

  it('reports the width the pointer travel asks for', () => {
    const { props, handle } = renderResizable({ width: 416 });

    dispatchPointerEvent(handle, 'pointerdown', { pointerId: 1, clientX: 600 });
    dispatchPointerEvent(handle, 'pointermove', {
      pointerId: 1,
      clientX: 520,
      buttons: 1,
    });
    dispatchPointerEvent(handle, 'pointerup', { pointerId: 1, clientX: 520 });

    expect(props.onWidthChange).toHaveBeenCalledTimes(1);
    expect(props.onWidthChange).toHaveBeenCalledWith(496);
  });

  it('does not let the absolute pointer position decide the width', () => {
    const { props, handle } = renderResizable({ width: 416 });

    dispatchPointerEvent(handle, 'pointerdown', { pointerId: 1, clientX: 900 });
    dispatchPointerEvent(handle, 'pointermove', {
      pointerId: 1,
      clientX: 900,
      buttons: 1,
    });

    expect(props.onWidthChange).toHaveBeenCalledWith(416);
  });

  it('clamps the drag at both bounds', () => {
    const { props, handle } = renderResizable({ width: 416 });

    dispatchPointerEvent(handle, 'pointerdown', { pointerId: 1, clientX: 600 });
    dispatchPointerEvent(handle, 'pointermove', {
      pointerId: 1,
      clientX: 0,
      buttons: 1,
    });
    dispatchPointerEvent(handle, 'pointermove', {
      pointerId: 1,
      clientX: 5_000,
      buttons: 1,
    });

    expect(props.onWidthChange).toHaveBeenNthCalledWith(
      1,
      LOG_DRAWER_WIDTH_MAX,
    );
    expect(props.onWidthChange).toHaveBeenNthCalledWith(
      2,
      LOG_DRAWER_WIDTH_MIN,
    );
  });

  it('ends the drag instead of resizing when no button is held', () => {
    const { props, handle } = renderResizable();

    dispatchPointerEvent(handle, 'pointerdown', { pointerId: 4, clientX: 600 });
    dispatchPointerEvent(handle, 'pointermove', { pointerId: 4, clientX: 560 });

    expect(props.onWidthChange).not.toHaveBeenCalled();
    expect(props.onResizeEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores a pointermove that belongs to another pointer', () => {
    const { props, handle } = renderResizable();

    dispatchPointerEvent(handle, 'pointerdown', { pointerId: 1, clientX: 600 });
    dispatchPointerEvent(handle, 'pointermove', {
      pointerId: 2,
      clientX: 500,
      buttons: 1,
    });

    expect(props.onWidthChange).not.toHaveBeenCalled();
  });

  it('ignores a pointermove after the drag ended', () => {
    const { props, handle } = renderResizable();

    dispatchPointerEvent(handle, 'pointerdown', { pointerId: 1, clientX: 600 });
    dispatchPointerEvent(handle, 'pointerup', { pointerId: 1, clientX: 600 });
    dispatchPointerEvent(handle, 'pointermove', {
      pointerId: 1,
      clientX: 500,
      buttons: 1,
    });

    expect(props.onWidthChange).not.toHaveBeenCalled();
  });

  it('does not start a drag on a secondary button', () => {
    const { props, handle, stubs } = renderResizable();

    dispatchPointerEvent(handle, 'pointerdown', {
      pointerId: 9,
      clientX: 600,
      button: 2,
    });
    dispatchPointerEvent(handle, 'pointermove', {
      pointerId: 9,
      clientX: 500,
      buttons: 2,
    });

    expect(props.onResizeStart).not.toHaveBeenCalled();
    expect(stubs.setPointerCapture).not.toHaveBeenCalled();
    expect(props.onWidthChange).not.toHaveBeenCalled();
  });

  it('brackets a drag with the resize start and end intents', () => {
    const { props, handle, stubs } = renderResizable();

    dispatchPointerEvent(handle, 'pointerdown', { pointerId: 7, clientX: 700 });
    dispatchPointerEvent(handle, 'pointerup', { pointerId: 7, clientX: 700 });

    expect(props.onResizeStart).toHaveBeenCalledTimes(1);
    expect(props.onResizeEnd).toHaveBeenCalledTimes(1);
    expect(stubs.setPointerCapture).toHaveBeenCalledWith(7);
    expect(stubs.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('ends the drag on pointercancel as well', () => {
    const { props, handle } = renderResizable();

    dispatchPointerEvent(handle, 'pointerdown', { pointerId: 2, clientX: 700 });
    dispatchPointerEvent(handle, 'pointercancel', { pointerId: 2, clientX: 700 });

    expect(props.onResizeStart).toHaveBeenCalledTimes(1);
    expect(props.onResizeEnd).toHaveBeenCalledTimes(1);
  });

  it('narrows and widens with the arrow keys', () => {
    const { props, handle } = renderResizable({ width: 416 });

    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });

    expect(props.onWidthChange).toHaveBeenNthCalledWith(
      1,
      416 + LOG_DRAWER_WIDTH_STEP,
    );
    expect(props.onWidthChange).toHaveBeenNthCalledWith(
      2,
      416 - LOG_DRAWER_WIDTH_STEP,
    );
  });

  it('takes the large step while Shift is held', () => {
    const { props, handle } = renderResizable({ width: 416 });

    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });

    expect(props.onWidthChange).toHaveBeenCalledWith(
      416 + LOG_DRAWER_WIDTH_STEP_LARGE,
    );
  });

  it('jumps to the bounds with Home and End', () => {
    const { props, handle } = renderResizable({ width: 500 });

    fireEvent.keyDown(handle, { key: 'Home' });
    fireEvent.keyDown(handle, { key: 'End' });

    expect(props.onWidthChange).toHaveBeenNthCalledWith(1, LOG_DRAWER_WIDTH_MIN);
    expect(props.onWidthChange).toHaveBeenNthCalledWith(2, LOG_DRAWER_WIDTH_MAX);
  });

  it('ignores a key that cannot resize', () => {
    const { props, handle } = renderResizable();

    fireEvent.keyDown(handle, { key: 'Enter' });

    expect(props.onWidthChange).not.toHaveBeenCalled();
  });

  it('resets the width on a double click', () => {
    const { props, handle } = renderResizable({ width: 700 });

    fireEvent.doubleClick(handle);

    expect(props.onWidthReset).toHaveBeenCalledTimes(1);
  });

  it('drops the transform transition while resizing', () => {
    renderResizable({ isResizing: true });

    expect(getPanel().className).not.toContain('transition-transform');
    expect(getPanel().className).toContain('transition-none');
  });

  it('keeps the transform transition while idle', () => {
    renderResizable({ isResizing: false });

    expect(getPanel().className).toContain('transition-transform');
  });

  it('publishes the width as a custom property on the panel', () => {
    renderResizable({ width: 512 });

    expect(getPanel().style.getPropertyValue(LOG_DRAWER_WIDTH_CSS_VAR)).toBe(
      '512px',
    );
  });
});
