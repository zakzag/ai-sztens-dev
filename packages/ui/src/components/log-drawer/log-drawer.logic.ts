import { LOG_DRAWER_OPEN_LABEL } from './log-drawer.const.js';

/**
 * Builds the accessible name of the collapsed tab.
 *
 * The badge is decorative, so the unseen count has to be part of the label —
 * otherwise a screen reader user would never learn that new entries arrived
 * (AIS-82 decision D7).
 *
 * @param unseenCount - number of entries not seen yet; `0` means none.
 * @returns the open label alone, or with the count in parentheses.
 */
export function toLogDrawerTabLabel(unseenCount: number): string {
  if (unseenCount <= 0) {
    return LOG_DRAWER_OPEN_LABEL;
  }

  return `${LOG_DRAWER_OPEN_LABEL} (${unseenCount} új)`;
}
