import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';

/** Props of the table shell (`Table`). */
export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  readonly children?: ReactNode;
}

/** Props of a table section (`TableHead`, `TableBody`). */
export interface TableSectionProps extends HTMLAttributes<HTMLTableSectionElement> {
  readonly children?: ReactNode;
}

/** Props of a table row (`TableRow`). */
export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  readonly children?: ReactNode;
}

/** Props of a header cell (`TableHeaderCell`). */
export interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  readonly children?: ReactNode;
}

/** Props of a body cell (`TableCell`). */
export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  readonly children?: ReactNode;
}
