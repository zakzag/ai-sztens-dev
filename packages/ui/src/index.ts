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
