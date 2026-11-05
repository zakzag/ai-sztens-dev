/**
 * Constants of {@link Pagination}.
 *
 * Copy, the DOM id of the limit selector and the three class recipes live here so
 * the component stays markup and the tests assert against the same literals the
 * UI renders.
 */

/** Page buttons rendered at most, including the current one. */
export const PAGINATION_DEFAULT_MAX_BUTTONS = 7;

/** Accessible name of the pager `<nav>`. */
export const PAGINATION_DEFAULT_ARIA_LABEL = 'Lapozás';

/** Accessible name of the “previous page” control. */
export const PAGINATION_PREVIOUS_LABEL = 'Előző oldal';

/** Accessible name of the “next page” control. */
export const PAGINATION_NEXT_LABEL = 'Következő oldal';

/** Visible label of the page-size selector. */
export const PAGINATION_LIMIT_LABEL = 'Oldalméret';

/** DOM id that wires the page-size `<label>` to its `<select>`. */
export const PAGINATION_LIMIT_ID = 'pagination-limit';

/** Glyph inside the previous/next controls (the accessible name is on the button). */
export const PAGINATION_PREVIOUS_GLYPH = '‹';

/** Glyph inside the previous/next controls (the accessible name is on the button). */
export const PAGINATION_NEXT_GLYPH = '›';

/** Separator between the first and last row numbers of the visible range. */
export const PAGINATION_RANGE_DASH = '–';

/** Separator between the visible range and the total row count. */
export const PAGINATION_RANGE_SEPARATOR = ' / ';

/** Resting recipe of a page button (`prev`, `next`, page number). */
export const PAGINATION_CONTROL_CLASSES =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-control border border-hairline border-border-hairline bg-surface-raised px-2 text-sm text-text-secondary shadow-neu-raised transition-shadow duration-fast hover:shadow-neu-pressed focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:opacity-60';

/** Overlay applied to the button of the page being shown. */
export const PAGINATION_ACTIVE_CLASSES =
  'bg-tertiary text-text-inverse shadow-neu-pressed';

/** Recipe of the page-size `<select>`. */
export const PAGINATION_SELECT_CLASSES =
  'rounded-control border border-hairline border-border-hairline bg-surface-sunken px-2 py-1 text-sm text-text-primary shadow-neu-inset focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus-ring';
