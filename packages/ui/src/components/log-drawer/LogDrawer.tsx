import { useEffect, useId } from 'react';
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
  LOG_DRAWER_TITLE,
  LOG_FILTERS,
  LOG_FILTER_LABELS,
} from './log-drawer.const.js';
import { toLogDrawerHandleLabel } from './log-drawer.logic.js';
import { LogEntryRow } from './LogEntryRow.js';
import {
  logDrawerFooterVariants,
  logDrawerHeaderVariants,
  logDrawerListVariants,
  logDrawerPanelVariants,
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
}: LogDrawerProps) {
  const panelId = `${useId()}${LOG_DRAWER_PANEL_ID_SUFFIX}`;

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

  return (
    <>
      <aside
        id={panelId}
        role="log"
        aria-live="off"
        aria-label={LOG_DRAWER_TITLE}
        aria-hidden={!isOpen}
        className={cn(
          logDrawerPanelVariants(),
          isOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full',
        )}
      >
        {isOpen ? (
          <>
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
