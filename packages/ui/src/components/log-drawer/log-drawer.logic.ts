import { LOG_DRAWER_CLOSE_LABEL, LOG_DRAWER_OPEN_LABEL } from './log-drawer.const.js';

/**
 * Builds the accessible name of the single drawer handle.
 *
 * The handle is present in **both** states (AIS-136 `D4`), so its name has to
 * say what activating it would *do*: open the panel while it is collapsed, close
 * it while it is open. The badge is decorative, so an unseen count must also be
 * part of the name — otherwise a screen reader user would never learn that new
 * entries arrived (AIS-82 decision D7).
 *
 * @param unseenCount - number of entries not seen yet; `0` means none.
 * @param isOpen - whether the panel is currently open.
 * @returns the action label alone, or with the count in parentheses.
 */
export function toLogDrawerHandleLabel(
  unseenCount: number,
  isOpen: boolean,
): string {
  const label = isOpen ? LOG_DRAWER_CLOSE_LABEL : LOG_DRAWER_OPEN_LABEL;

  if (unseenCount <= 0) {
    return label;
  }

  return `${label} (${unseenCount} új)`;
}
