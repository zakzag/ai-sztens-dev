import { Badge } from '../badge/Badge.js';
import type { StatusBadgeProps } from './status-badge.interface.js';

/**
 * A `Badge` that also carries the machine-readable status.
 *
 * It adds exactly two things to `Badge`: the `data-status` hook (so a test or an
 * e2e selector can find a row by its state without matching Hungarian copy) and
 * a single, type-checked place where the *variant vocabulary* is named. No new
 * colour is introduced — every variant already exists on `Badge`.
 *
 * @param props - see {@link StatusBadgeProps}.
 */
export function StatusBadge({ status, label, variant }: StatusBadgeProps) {
  return (
    <Badge variant={variant} data-status={status}>
      {label}
    </Badge>
  );
}
