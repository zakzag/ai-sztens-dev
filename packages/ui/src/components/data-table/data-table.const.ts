/**
 * Constants of {@link DataTable}.
 *
 * Copy, the default placeholder count and the two class maps live here so the
 * components stay markup and a test can assert against the same literals.
 */

import type { DataTableAlign, DataTableSortOrder } from './data-table.interface.js';

/** Placeholder rows rendered while the first page is loading. */
export const DATA_TABLE_DEFAULT_LOADING_ROWS = 5;

/** Accessible name of the actions column, which has no visible label. */
export const DATA_TABLE_ACTIONS_HEADER = 'Műveletek';

/** Title of the fallback empty state when the caller supplies no `empty` slot. */
export const DATA_TABLE_EMPTY_TITLE = 'Nincs megjeleníthető adat.';

/** The direction a sortable column starts with. */
export const DATA_TABLE_FIRST_SORT_ORDER: DataTableSortOrder = 'asc';

/** Header/cell alignment classes, keyed by the column's `align`. */
export const DATA_TABLE_ALIGNMENT_CLASSES: Readonly<
  Record<DataTableAlign, string>
> = {
  start: 'text-left',
  end: 'text-right',
};

/**
 * Recipe of the sort control inside a header cell.
 *
 * It inherits the header's typography on purpose (`uppercase`, `text-xs`), so the
 * button is invisible as a *control* until it is hovered or focused — but it is
 * always focusable and keyboard-operable.
 */
export const DATA_TABLE_SORT_BUTTON_CLASSES =
  'inline-flex items-center gap-1 rounded-control px-1 py-0.5 uppercase tracking-wide transition-shadow duration-fast hover:text-text-primary focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus-ring';
