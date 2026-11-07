import type { ToastLevel } from '../toast/toast.interface.js';
import type {
  LogEntryCopyFlags,
  LogLevelFilter,
} from './log-drawer.interface.js';

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
export const LOG_DRAWER_RESIZE_HANDLE_LABEL =
  'Naplópanel szélességének állítása';

/**
 * CSS custom property carrying the panel width.
 *
 * Declared once and shared by the inline style and the width utility of the
 * panel, so the two can never drift apart (AIS-150).
 */
export const LOG_DRAWER_WIDTH_CSS_VAR = '--log-drawer-width';

/**
 * Verb of the accessible name of a **collapsed** row's header button.
 *
 * The header is a single `<button>` whose glyph and level text say nothing
 * about the affordance, so the name has to state what activating it would do —
 * and it flips with the row's state instead of inventing a static "details"
 * label (AIS-153 decision D-B).
 */
export const LOG_ENTRY_DETAILS_TOGGLE_LABEL_OPEN = 'Részletek megnyitása';

/** Verb of the accessible name of an **expanded** row's header button. */
export const LOG_ENTRY_DETAILS_TOGGLE_LABEL_CLOSE = 'Részletek bezárása';

/**
 * Accessible name of the expanded detail region.
 *
 * The region has no visible heading — it is a key–value list directly under the
 * row — so `role="region"` needs this label to be announced as a landmark at
 * all.
 */
export const LOG_ENTRY_DETAILS_REGION_LABEL = 'Részletes adatok';

/**
 * Shown inside an expanded region whose entry carries no `details`.
 *
 * An empty region would be indistinguishable from a broken one, so "no facts"
 * is stated explicitly instead of rendering nothing (AIS-153 DoD).
 */
export const LOG_ENTRY_DETAILS_EMPTY_LABEL = 'Nincs részletes adat';

/**
 * Suffix of the `useId()` based detail-region id.
 *
 * `aria-controls` must point at one unique element per row, and the drawer
 * renders an unbounded number of rows, so the id is derived per instance.
 */
export const LOG_ENTRY_DETAILS_REGION_ID_SUFFIX = '-log-entry-details';

/**
 * Suffix of the empty-state paragraph's id.
 *
 * The region references it through `aria-describedby`, so a screen reader user
 * learns that the region is empty *before* tabbing into the copy controls.
 */
export const LOG_ENTRY_DETAILS_EMPTY_ID_SUFFIX = '-log-entry-details-empty';

/**
 * Label of the control that copies the entry's request id.
 *
 * Visible text, so it doubles as the accessible name — no separate `aria-label`
 * that could drift from what the user reads.
 */
export const LOG_ENTRY_COPY_REQUEST_ID_LABEL = 'requestId másolása';

/** Label of the control that copies the whole entry as JSON. */
export const LOG_ENTRY_COPY_ENTRY_LABEL = 'JSON másolása';

/**
 * Feedback a copy control shows after a successful copy.
 *
 * Each control owns its own flag and timer (AIS-153 decision A0), so pressing
 * `JSON` never relabels the request-id button.
 */
export const LOG_ENTRY_COPY_DONE_LABEL = 'Kimásolva';

/**
 * How long a copy control keeps its feedback label, in milliseconds.
 *
 * Long enough to be read after the click, short enough that the control is back
 * to its action label by the time the user wants to copy again.
 */
export const LOG_ENTRY_COPY_FEEDBACK_MS = 2000;

/**
 * Flag state every copy control starts in.
 *
 * Declared once so the initial `useState` of the row is not a fresh object
 * literal on every render, and so "no control has confirmed anything yet" has a
 * name a test can assert against.
 */
export const LOG_ENTRY_COPY_IDLE: LogEntryCopyFlags = {
  requestId: false,
  json: false,
};

/**
 * Label whose field value the request-id control copies.
 *
 * The comparison is case-insensitive (see `findRequestIdField`), because the
 * label is emitter-owned text and may arrive as `requestId`, `Request-Id` or
 * `requestID`.
 */
export const LOG_ENTRY_REQUEST_ID_FIELD_LABEL = 'requestId';

/**
 * Verb of the accessible name of a collapsed JSON value (AIS-163).
 *
 * A JSON value (`queryKey`, `body`, `responseMeta`) stays the single-line
 * string the store stored; this control reveals the indented form beside it.
 * The label names the format as well as the action, because "expand" alone
 * would not tell a screen reader user **what** is being expanded.
 */
export const LOG_DETAIL_JSON_TOGGLE_LABEL_OPEN = 'JSON kibontása';

/** Verb of the accessible name of an expanded JSON value. */
export const LOG_DETAIL_JSON_TOGGLE_LABEL_CLOSE = 'JSON összecsukása';

/**
 * Suffix of the pretty-JSON region id.
 *
 * The row's `useId()` is the prefix and the field index the tail, so every
 * `aria-controls` in a row full of JSON values points at exactly one element.
 */
export const LOG_DETAIL_JSON_REGION_ID_SUFFIX = '-log-detail-json';
