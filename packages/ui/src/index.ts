/**
 * `@callback/ui` — the only source of visual primitives and tokens for the
 * React apps. Explicit exports only; the package has no barrel re-exports.
 */

export { cn } from './lib/cn.js';

export { Button } from './components/button/Button.js';
export { buttonVariants } from './components/button/button.variants.js';
export type { ButtonProps } from './components/button/button.interface.js';
export type { ButtonVariants } from './components/button/button.variants.js';

export { Input } from './components/input/Input.js';
export { inputVariants } from './components/input/input.variants.js';
export type { InputProps } from './components/input/input.interface.js';
export type { InputVariants } from './components/input/input.variants.js';

export { Textarea } from './components/textarea/Textarea.js';
export { textareaVariants } from './components/textarea/textarea.variants.js';
export type { TextareaProps } from './components/textarea/textarea.interface.js';
export type { TextareaVariants } from './components/textarea/textarea.variants.js';

export { Card } from './components/card/Card.js';
export type { CardProps } from './components/card/card.interface.js';

export { Table } from './components/table/Table.js';
export { TableHead } from './components/table/TableHead.js';
export { TableBody } from './components/table/TableBody.js';
export { TableRow } from './components/table/TableRow.js';
export { TableHeaderCell } from './components/table/TableHeaderCell.js';
export { TableCell } from './components/table/TableCell.js';
export type {
  TableProps,
  TableSectionProps,
  TableRowProps,
  TableHeaderCellProps,
  TableCellProps,
} from './components/table/table.interface.js';

export { Badge } from './components/badge/Badge.js';
export { badgeVariants } from './components/badge/badge.variants.js';
export type { BadgeProps } from './components/badge/badge.interface.js';
export type { BadgeVariants } from './components/badge/badge.variants.js';

export { Alert } from './components/alert/Alert.js';
export { alertVariants } from './components/alert/alert.variants.js';
export type { AlertProps } from './components/alert/alert.interface.js';
export type { AlertVariants } from './components/alert/alert.variants.js';

export { Banner } from './components/banner/Banner.js';
export { bannerVariants } from './components/banner/banner.variants.js';
export type {
  BannerProps,
  BannerBaseProps,
  BannerDismissibleProps,
  BannerStaticProps,
} from './components/banner/banner.interface.js';
export type { BannerVariants } from './components/banner/banner.variants.js';

export { Skeleton } from './components/skeleton/Skeleton.js';
export { skeletonVariants } from './components/skeleton/skeleton.variants.js';
export type { SkeletonProps } from './components/skeleton/skeleton.interface.js';
export type { SkeletonVariants } from './components/skeleton/skeleton.variants.js';

export { Spinner } from './components/spinner/Spinner.js';
export { spinnerVariants } from './components/spinner/spinner.variants.js';
export { SPINNER_DEFAULT_LABEL } from './components/spinner/spinner.const.js';
export type { SpinnerProps } from './components/spinner/spinner.interface.js';
export type { SpinnerVariants } from './components/spinner/spinner.variants.js';

export { EmptyState } from './components/empty-state/EmptyState.js';
export type {
  EmptyStateProps,
  EmptyStateAction,
} from './components/empty-state/empty-state.interface.js';

export { DescriptionList } from './components/description-list/DescriptionList.js';
export type {
  DescriptionListProps,
  DescriptionListItem,
} from './components/description-list/description-list.interface.js';

export { StatusBadge } from './components/status-badge/StatusBadge.js';
export type { StatusBadgeProps } from './components/status-badge/status-badge.interface.js';

export { Pagination } from './components/pagination/Pagination.js';
export {
  PAGINATION_DEFAULT_ARIA_LABEL,
  PAGINATION_LIMIT_LABEL,
  PAGINATION_NEXT_LABEL,
  PAGINATION_PREVIOUS_LABEL,
} from './components/pagination/pagination.const.js';
export {
  toVisiblePages,
  toRangeLabel,
  clampLimit,
} from './components/pagination/pagination.logic.js';
export type {
  PaginationProps,
  PaginationMeta,
} from './components/pagination/pagination.interface.js';

export { DataTable } from './components/data-table/DataTable.js';
export { DATA_TABLE_DEFAULT_LOADING_ROWS } from './components/data-table/data-table.const.js';
export type {
  DataTableProps,
  DataTableColumn,
  DataTableSort,
  DataTableSortOrder,
  DataTableAlign,
} from './components/data-table/data-table.interface.js';
