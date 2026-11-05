import type { DataTableProps } from './data-table.interface.js';
import {
  DATA_TABLE_ALIGNMENT_CLASSES,
  DATA_TABLE_DEFAULT_LOADING_ROWS,
  DATA_TABLE_EMPTY_TITLE,
} from './data-table.const.js';
import { DataTableHead } from './DataTableHead.js';
import { DataTableLoadingRows } from './DataTableLoadingRows.js';
import { EmptyState } from '../empty-state/EmptyState.js';
import { Table } from '../table/Table.js';
import { TableBody } from '../table/TableBody.js';
import { TableCell } from '../table/TableCell.js';
import { TableRow } from '../table/TableRow.js';

/**
 * Server-paginated, column-driven data table.
 *
 * It composes the six `Table*` primitives (decision **D1** of AIS-116: extend,
 * do not replace) and adds the four states every list needs:
 * - loading → placeholder rows, header kept;
 * - empty → the caller's `empty` slot, or a neutral `EmptyState`;
 * - success → one row per item;
 * - failure → **not here**: an unavailable list is the page's data being
 *   unavailable, and the page renders `PageErrorState` (plan `D11`).
 *
 * Sorting is reported, never applied (decision **D2**): the server owns the order,
 * the URL owns the request.
 *
 * @param props - see {@link DataTableProps}.
 */
export function DataTable<TRow>({
  rows,
  columns,
  rowKey,
  sort = null,
  onSortChange,
  isLoading = false,
  loadingRowCount = DATA_TABLE_DEFAULT_LOADING_ROWS,
  empty,
  caption,
  rowActions,
}: DataTableProps<TRow>) {
  const hasRowActions = rowActions !== undefined;

  if (!isLoading && rows.length === 0) {
    return <>{empty ?? <EmptyState title={DATA_TABLE_EMPTY_TITLE} />}</>;
  }

  return (
    <Table>
      {caption === undefined ? null : (
        <caption className="sr-only">{caption}</caption>
      )}
      <DataTableHead
        columns={columns}
        sort={sort}
        onSortChange={onSortChange}
        hasRowActions={hasRowActions}
      />
      {isLoading ? (
        <DataTableLoadingRows
          rowCount={loadingRowCount}
          columnCount={columns.length}
          hasRowActions={hasRowActions}
        />
      ) : (
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={DATA_TABLE_ALIGNMENT_CLASSES[column.align ?? 'start']}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
              {rowActions === undefined ? null : (
                <TableCell className="text-right">{rowActions(row)}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      )}
    </Table>
  );
}
