import type { ToastLevel } from '../toast/toast.interface.js';
import type { LogLevelFilter } from './log-drawer.interface.js';

/** Panel heading and accessible name of the panel. */
export const LOG_DRAWER_TITLE = 'Rendszernapló';

/**
 * Accessible name of the handle while the panel is collapsed.
 *
 * The unseen count is appended by {@link toLogDrawerHandleLabel}, so the label
 * always describes the action the handle offers in its **current** state.
 */
export const LOG_DRAWER_OPEN_LABEL = 'Rendszernapló megnyitása';

/**
 * Accessible name of the handle while the panel is open (its glyph is
 * `aria-hidden`).
 *
 * Deliberately different from {@link LOG_DRAWER_HEADER_CLOSE_LABEL}: the handle
 * and the header `✕` are two separate controls, and two buttons with the same
 * accessible name are indistinguishable to a screen reader user.
 */
export const LOG_DRAWER_CLOSE_LABEL = 'Rendszernapló bezárása';

/**
 * Accessible name of the `✕` in the panel header — the secondary close path
 * next to the handle (its glyph is `aria-hidden`).
 */
export const LOG_DRAWER_HEADER_CLOSE_LABEL = 'Naplópanel bezárása';

/** Handle glyph while collapsed: points at the panel it would open. */
export const LOG_DRAWER_HANDLE_COLLAPSED_GLYPH = '‹';

/** Handle glyph while open: points away from the panel it would close. */
export const LOG_DRAWER_HANDLE_OPEN_GLYPH = '›';

/**
 * Visible caption of the handle.
 *
 * Decorative (`aria-hidden`), because the accessible name of the button comes
 * from `aria-label` — a screen reader must hear the action, not the word “Log”.
 */
export const LOG_DRAWER_HANDLE_CAPTION = 'Log';

/** Shown inside the list when the caller passed no rows. */
export const LOG_DRAWER_EMPTY_LABEL = 'Még nincs bejegyzés.';

/** Footer button that asks the host for the next, older slice. */
export const LOG_DRAWER_LOAD_MORE_LABEL = 'Korábbiak betöltése';

/** Header button that empties the log. */
export const LOG_DRAWER_CLEAR_LABEL = 'Törlés';

/** Accessible name of the filter chip group. */
export const LOG_DRAWER_FILTER_GROUP_LABEL = 'Szűrés szint szerint';

/** Suffix of the `useId()` based panel id, so the tab's `aria-controls` is unique. */
export const LOG_DRAWER_PANEL_ID_SUFFIX = '-log-panel';

/**
 * Stacking class of the panel and the tab.
 *
 * Overlay depth is **layout**, not colour: `theme.css` has no z-scale token and
 * the palette gate does not cover it (AIS-117 decision D5). `z-40` sits below
 * the modal overlay (`DIALOG_CONTENT_Z_INDEX`, `z-50`) and below the toast stack
 * (`z-60`): the log is a non-modal side view, so a dialog must cover it and a
 * toast must stay readable on top of it (AIS-82 decision D4).
 */
export const LOG_DRAWER_Z_INDEX = 'z-40';

/**
 * Chip order of the filter row.
 *
 * `all` first, then the five levels newest-to-oldest by severity, so the
 * rendered order matches {@link LOG_FILTER_LABELS}.
 */
export const LOG_FILTERS: readonly LogLevelFilter[] = [
  'all',
  'success',
  'error',
  'warning',
  'info',
  'system',
];

/** Visible chip labels, one per filter value. */
export const LOG_FILTER_LABELS: Record<LogLevelFilter, string> = {
  all: 'Mind',
  success: 'Siker',
  error: 'Hiba',
  warning: 'Figyelmeztetés',
  info: 'Info',
  system: 'Rendszer',
};

/**
 * Visible level text of a row.
 *
 * Rendered next to the glyph so the severity is never carried by colour alone
 * (AIS-82 decision D9).
 */
export const LOG_LEVEL_LABELS: Record<ToastLevel, string> = {
  success: 'Siker',
  error: 'Hiba',
  warning: 'Figyelmeztetés',
  info: 'Info',
  system: 'Rendszer',
};

/**
 * Panel width the drawer opens with, in CSS pixels.
 *
 * Matches the `max-w-[26rem]` the panel had before it became resizable
 * (AIS-150), so a reload with no stored preference looks unchanged.
 */
export const LOG_DRAWER_WIDTH_DEFAULT = 416;

/** Narrowest width the handle allows; below it the header actions collide. */
export const LOG_DRAWER_WIDTH_MIN = 320;

/**
 * Widest width the handle allows.
 *
 * Deliberately well below `md` viewport width: the panel must never hide the
 * page it annotates, and the page behind stays interactive (the drawer is
 * non-modal, AIS-82 D3).
 */
export const LOG_DRAWER_WIDTH_MAX = 720;

/** Width change of one `ArrowLeft`/`ArrowRight` press, in CSS pixels. */
export const LOG_DRAWER_WIDTH_STEP = 16;

/** Width change of one arrow press while `Shift` is held, in CSS pixels. */
export const LOG_DRAWER_WIDTH_STEP_LARGE = 64;

/**
 * Accessible name of the resize handle.
 *
 * The handle carries no visible text, so this label **is** its name: it must
 * say what the separator resizes, not "handle" (AIS-150).
 */
export const LOG_DRAWER_RESIZE_HANDLE_LABEL = 'Naplópanel szélességének állítása';

/**
 * CSS custom property carrying the panel width.
 *
 * Declared once and shared by the inline style and the width utility of the
 * panel, so the two can never drift apart (AIS-150).
 */
export const LOG_DRAWER_WIDTH_CSS_VAR = '--log-drawer-width';
