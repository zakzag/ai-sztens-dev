import { useEffect, useId } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { cn } from '../../lib/cn.js';
import { Badge } from '../badge/Badge.js';
import { Button } from '../button/Button.js';
import {
  LOG_DRAWER_CLEAR_LABEL,
  LOG_DRAWER_EMPTY_LABEL,
  LOG_DRAWER_FILTER_GROUP_LABEL,
  LOG_DRAWER_HANDLE_CAPTION,
  LOG_DRAWER_HANDLE_COLLAPSED_GLYPH,
  LOG_DRAWER_HANDLE_OPEN_GLYPH,
  LOG_DRAWER_HEADER_CLOSE_LABEL,
  LOG_DRAWER_LOAD_MORE_LABEL,
  LOG_DRAWER_PANEL_ID_SUFFIX,
  LOG_DRAWER_RESIZE_HANDLE_LABEL,
  LOG_DRAWER_TITLE,
  LOG_FILTERS,
  LOG_FILTER_LABELS,
} from './log-drawer.const.js';
import {
  toLogDrawerHandleLabel,
  toWidthFromKey,
  toWidthFromPointer,
  toWidthStyle,
} from './log-drawer.logic.js';
import { LogEntryRow } from './LogEntryRow.js';
import {
  logDrawerFooterVariants,
  logDrawerHeaderVariants,
  logDrawerListVariants,
  logDrawerPanelVariants,
  logDrawerResizeHandleVariants,
  logDrawerResizeRailVariants,
  logDrawerTabVariants,
  logFilterChipVariants,
} from './log-drawer.variants.js';
import type { LogDrawerProps } from './log-drawer.interface.js';

/**
 * Side log panel with **one** always-visible arrow handle (AIS-82, AIS-136).
 *
 * Presentational only — it owns no data, no filter state and no page window; the
 * host passes the already-sliced rows and receives every intent as a callback
 * (AIS-82 decisions D1, D7).
 *
 * The handle is a single `<button>` that exists in **both** states (AIS-136
 * `D4`): it opens the panel while collapsed and closes it while open, flips its
 * glyph and its accessible name with `isOpen`, and always exposes
 * `aria-expanded` + `aria-controls`. It is a **sibling after** the panel rather
 * than a child, because the panel is `pointer-events-none` while collapsed — a
 * handle inside it would be unreachable in exactly the state that needs it.
 * Being the later sibling also paints it above the panel at the same `z-index`,
 * so the handle rides the panel edge without covering it: the open panel
 * reserves a matching right gutter.
 *
 * The panel is **not** modal (D3): no overlay, no focus trap, the page behind
 * stays scrollable. The one side effect in the component is a `document`
 * `keydown` listener that closes the panel on `Escape` (D6) — it is registered
 * only while the panel is open. The panel element stays mounted so the handle's
 * `aria-controls` never dangles and the slide animates in both directions; its
 * content is rendered only while open, so nothing hidden is focusable.
 *
 * `✕` and `Escape` remain as secondary close paths; the handle is the primary
 * toggle in both directions.
 *
 * The resize separator on the panel's left edge (AIS-150) is the same
 * presentational contract: it reports `onResizeStart`, `onWidthChange`,
 * `onResizeEnd` and `onWidthReset`, and the host owns the width. It is rendered
 * only while the panel is open and only from `md` up — below that the panel is
 * full width, so there is nothing to resize.
 *
 * @param props - see {@link LogDrawerProps}.
 */
export function LogDrawer({
  entries,
  isOpen,
  unseenCount,
  levelFilter,
  hasMore,
  onToggle,
  onClose,
  onFilterChange,
  onLoadMore,
  onClear,
  formatTimestamp,
  width,
  widthRange,
  isResizing,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
  onWidthReset,
}: LogDrawerProps) {
  const panelId = `${useId()}${LOG_DRAWER_PANEL_ID_SUFFIX}`;
  const widthStyle = toWidthStyle(width);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  /**
   * Starts a drag: the host flips `isResizing` and the pointer is captured, so
   * the moves keep arriving even when the pointer leaves the 12 px handle.
   *
   * @param event - the `pointerdown` of the handle.
   */
  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    onResizeStart();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  /**
   * Reports the width the pointer asks for.
   *
   * The viewport width is read at event time (not stored), so a window resize
   * during a drag cannot use a stale value.
   *
   * @param event - the `pointermove` of the handle.
   */
  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    onWidthChange(
      toWidthFromPointer(event.clientX, window.innerWidth, widthRange),
    );
  }

  /**
   * Ends a drag and releases the capture.
   *
   * `pointerup` and `pointercancel` are both wired here: a cancelled gesture must
   * not leave the host stuck in the resizing state.
   *
   * @param event - the `pointerup`/`pointercancel` of the handle.
   */
  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    onResizeEnd();
  }

  /**
   * Resizes with the keyboard, following the WAI-ARIA separator pattern.
   *
   * The event is only consumed when a key actually changes the width, so
   * unrelated keys (and an arrow that is already at its bound) still behave
   * normally.
   *
   * @param event - the `keydown` of the handle.
   */
  function handleHandleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const next = toWidthFromKey(event.key, width, widthRange, event.shiftKey);

    if (next === width) {
      return;
    }

    event.preventDefault();
    onWidthChange(next);
  }

  return (
    <>
      <aside
        id={panelId}
        role="log"
        aria-live="off"
        aria-label={LOG_DRAWER_TITLE}
        aria-hidden={!isOpen}
        style={widthStyle}
        className={cn(
          logDrawerPanelVariants({ isResizing }),
          isOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full',
        )}
      >
        {isOpen ? (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={LOG_DRAWER_RESIZE_HANDLE_LABEL}
              aria-valuenow={width}
              aria-valuemin={widthRange.min}
              aria-valuemax={widthRange.max}
              tabIndex={0}
              className={logDrawerResizeHandleVariants()}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onKeyDown={handleHandleKeyDown}
              onDoubleClick={onWidthReset}
            >
              <span
                aria-hidden="true"
                className={logDrawerResizeRailVariants()}
              />
            </div>

            <div className={logDrawerHeaderVariants()}>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{LOG_DRAWER_TITLE}</h2>
                <Badge variant="neutral">{entries.length}</Badge>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                  >
                    {LOG_DRAWER_CLEAR_LABEL}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={LOG_DRAWER_HEADER_CLOSE_LABEL}
                    onClick={onClose}
                  >
                    <span aria-hidden="true">✕</span>
                  </Button>
                </div>
              </div>

              <div
                role="group"
                aria-label={LOG_DRAWER_FILTER_GROUP_LABEL}
                className="flex flex-wrap gap-1"
              >
                {LOG_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={filter === levelFilter}
                    className={logFilterChipVariants({
                      selected: filter === levelFilter,
                    })}
                    onClick={() => onFilterChange(filter)}
                  >
                    {LOG_FILTER_LABELS[filter]}
                  </button>
                ))}
              </div>
            </div>

            <div className={logDrawerListVariants()}>
              {entries.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-secondary">
                  {LOG_DRAWER_EMPTY_LABEL}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <LogEntryRow
                        entry={entry}
                        formatTimestamp={formatTimestamp}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={logDrawerFooterVariants()}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={!hasMore}
                onClick={onLoadMore}
              >
                {LOG_DRAWER_LOAD_MORE_LABEL}
              </Button>
            </div>
          </>
        ) : null}
      </aside>

      <button
        type="button"
        className={logDrawerTabVariants({ isOpen })}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={toLogDrawerHandleLabel(unseenCount, isOpen)}
        onClick={onToggle}
      >
        <span aria-hidden="true">
          {isOpen ? LOG_DRAWER_HANDLE_OPEN_GLYPH : LOG_DRAWER_HANDLE_COLLAPSED_GLYPH}
        </span>
        {unseenCount > 0 ? <Badge variant="info">{unseenCount}</Badge> : null}
        <span className="text-xs font-medium" aria-hidden="true">
          {LOG_DRAWER_HANDLE_CAPTION}
        </span>
      </button>
    </>
  );
}
