import type { ReactNode } from 'react';
import type { BadgeVariants } from '../badge/badge.variants.js';

/**
 * Props of {@link StatusBadge}.
 *
 * `status` is the *domain* value (`queued`, `failed`, …) and is kept in the DOM
 * as `data-status`; `label` is the already-localised text and `variant` is the
 * verdict the domain mapper made (`toStatusVariant`). The component therefore
 * needs no domain knowledge of its own.
 */
export interface StatusBadgeProps {
  /** Machine-readable status; rendered as `data-status`, never as visible text. */
  readonly status: string;
  /** Visible text of the badge. */
  readonly label: ReactNode;
  /** Visual verdict, taken from the `Badge` variant vocabulary. */
  readonly variant: NonNullable<BadgeVariants['variant']>;
}
