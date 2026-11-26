import type { ReactNode } from 'react';

/** Horizontal alignment of a column's header and cells. */
export type DataTableAlign = 'start' | 'end';

/** Sort direction of the list, as the API contract spells it. */
export type DataTableSortOrder = 'asc' | 'desc';

/**
 * One column of {@link DataTable}.
 *
 * `cell` is a render function rather than a field name: the table knows nothing
 * about the row shape, so a column can render a badge, a formatted date or a
 * composed node without the primitive growing domain knowledge.
 */
export interface DataTableColumn<TRow> {
  /** Stable identifier; also what a sort reports back. */
  readonly id: string;
  /** Header content. */
  readonly header: ReactNode;
  /** Renders one cell of this column. */
  readonly cell: (row: TRow) => ReactNode;
  /** `true` makes the header a sort control. */
  readonly sortable?: boolean;
  /** Text alignment; defaults to `start`. */
  readonly align?: DataTableAlign;
}

/** The current sort of the list. */
export interface DataTableSort {
  /** `id` of the sorted column. */
  readonly columnId: string;
  /** Direction. */
  readonly order: DataTableSortOrder;
}

/**
 * Props of {@link DataTable}.
 *
 * **Decision D2 (AIS-116):** the table never sorts locally. It renders the order
 * the server returned and only *reports* the requested one (`onSortChange`),
 * because the truth lives in the query — which is kept in the URL.
 */
export interface DataTableProps<TRow> {
  /** Rows of the current page, in server order. */
  readonly rows: readonly TRow[];
  /** Column definitions, in render order. */
  readonly columns: readonly DataTableColumn<TRow>[];
  /** Stable React key of a row. */
  readonly rowKey: (row: TRow) => string;
  /** Current sort, or `null` when the list is unsorted. */
  readonly sort?: DataTableSort | null;
  /** Called with the sort the user asked for. */
  readonly onSortChange?: (sort: DataTableSort) => void;
  /** `true` renders skeleton rows and keeps the header. */
  readonly isLoading?: boolean;
  /** How many skeleton rows to render; defaults to `5`. */
  readonly loadingRowCount?: number;
  /** Rendered instead of the table when there are no rows. */
  readonly empty?: ReactNode;
  /** Table caption, exposed to assistive technology only. */
  readonly caption?: string;
  /** Renders an actions cell at the end of every row. */
  readonly rowActions?: (row: TRow) => ReactNode;
}

/** Props of the header row of {@link DataTable}. */
export interface DataTableHeadProps<TRow> {
  /** The column definitions. */
  readonly columns: readonly DataTableColumn<TRow>[];
  /** Current sort, used for `aria-sort` and for the toggle direction. */
  readonly sort: DataTableSort | null;
  /** Sort request; when absent the sortable headers stay plain text. */
  readonly onSortChange?: (sort: DataTableSort) => void;
  /** `true` renders the (visually empty) actions header cell. */
  readonly hasRowActions: boolean;
}

/** Props of the skeleton body of {@link DataTable}. */
export interface DataTableLoadingRowsProps {
  /** How many placeholder rows to render. */
  readonly rowCount: number;
  /** How many cells each placeholder row spans. */
  readonly columnCount: number;
  /** `true` adds the actions placeholder cell. */
  readonly hasRowActions: boolean;
}
