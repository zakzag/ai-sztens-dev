import type { DataTableHeadProps } from './data-table.interface.js';
import {
  DATA_TABLE_ACTIONS_HEADER,
  DATA_TABLE_ALIGNMENT_CLASSES,
  DATA_TABLE_SORT_BUTTON_CLASSES,
} from './data-table.const.js';
import { toAriaSort, toNextSort } from './data-table.logic.js';
import { TableHead } from '../table/TableHead.js';
import { TableHeaderCell } from '../table/TableHeaderCell.js';
import { TableRow } from '../table/TableRow.js';

/**
 * Header row of {@link DataTable}.
 *
 * A sortable column puts a `<button>` *inside* its `<th>` (a `<th>` may not be a
 * control itself), and the `<th>` carries `aria-sort` — that is the pair a screen
 * reader actually announces. A sortable column without an `onSortChange` handler
 * renders as plain text: a control nobody listens to is worse than no control.
 *
 * @param props - see {@link DataTableHeadProps}.
 */
export function DataTableHead<TRow>({
  columns,
  sort,
  onSortChange,
  hasRowActions,
}: DataTableHeadProps<TRow>) {
  return (
    <TableHead>
      <TableRow>
        {columns.map((column) => {
          // `aria-sort` describes the *order of the data* in the column, so it is
          // reported for every sortable column — even in a read-only table where
          // no handler is listening. Interactivity is a separate concern below.
          const isSortable = column.sortable === true;
          const isSortableInteractive =
            isSortable && onSortChange !== undefined;

          return (
            <TableHeaderCell
              key={column.id}
              aria-sort={isSortable ? toAriaSort(column.id, sort) : undefined}
              className={DATA_TABLE_ALIGNMENT_CLASSES[column.align ?? 'start']}
            >
              {isSortableInteractive ? (
                <button
                  type="button"
                  className={DATA_TABLE_SORT_BUTTON_CLASSES}
                  onClick={() => {
                    onSortChange(toNextSort(column.id, sort));
                  }}
                >
                  {column.header}
                </button>
              ) : (
                column.header
              )}
            </TableHeaderCell>
          );
        })}
        {hasRowActions ? (
          <TableHeaderCell className="text-right">
            <span className="sr-only">{DATA_TABLE_ACTIONS_HEADER}</span>
          </TableHeaderCell>
        ) : null}
      </TableRow>
    </TableHead>
  );
}
