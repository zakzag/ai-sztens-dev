import type { DataTableLoadingRowsProps } from './data-table.interface.js';
import { Skeleton } from '../skeleton/Skeleton.js';
import { TableBody } from '../table/TableBody.js';
import { TableCell } from '../table/TableCell.js';
import { TableRow } from '../table/TableRow.js';

/**
 * Placeholder body of {@link DataTable}.
 *
 * The shape of the real table is kept (same number of columns, same row height),
 * so the header and the layout do not jump when the response arrives. Nothing
 * here is announced: the surrounding region owns the “loading” message.
 *
 * @param props - see {@link DataTableLoadingRowsProps}.
 */
export function DataTableLoadingRows({
  rowCount,
  columnCount,
  hasRowActions,
}: DataTableLoadingRowsProps) {
  const rowIndexes = Array.from({ length: Math.max(1, rowCount) }, (_, i) => i);
  const columnIndexes = Array.from(
    { length: Math.max(1, columnCount) },
    (_, i) => i,
  );

  return (
    <TableBody>
      {rowIndexes.map((rowIndex) => (
        <TableRow key={rowIndex}>
          {columnIndexes.map((columnIndex) => (
            <TableCell key={columnIndex}>
              <Skeleton />
            </TableCell>
          ))}
          {hasRowActions ? (
            <TableCell>
              <Skeleton />
            </TableCell>
          ) : null}
        </TableRow>
      ))}
    </TableBody>
  );
}
