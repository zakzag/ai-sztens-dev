/**
 * Domain types and view models of a customer (AIS-19).
 *
 * The view model is the list's own shape: it carries **formatted text** and the
 * resolved badge variant instead of raw nullable wire fields, so no component
 * has to decide how a `null` tax number or a status renders. That decision is
 * made once, by the pure mapper, and is therefore testable without React.
 */

import type { CustomerStatus } from '@callback/shared';
import type { BadgeVariants } from '@callback/ui';

/** The badge vocabulary of `@callback/ui`, so the mapper cannot invent a variant. */
export type BadgeVariant = NonNullable<BadgeVariants['variant']>;

/**
 * One row of the customers list, ready to render.
 *
 * Every text field is already final: `displayName` has resolved `shortName ??
 * legalName`, and the three nullable wire values are rendered as their
 * placeholder copy. `status` is kept next to `statusLabel`/`statusVariant`
 * because `StatusBadge` needs the machine value for `data-status`.
 */
export interface CustomerRowViewModel {
  /** Customer uuid — the row key and the detail link segment. */
  readonly id: string;
  /** Generated identifier (`AIS-YYYYMM-NNN`), rendered in a monospace cell. */
  readonly customerNumber: string;
  /** `shortName ?? legalName`, chosen once by the mapper. */
  readonly displayName: string;
  /** Localised customer type. */
  readonly typeLabel: string;
  /** Tax number or the empty-value placeholder. */
  readonly taxNumberText: string;
  /** Machine status, kept for `data-status`. */
  readonly status: CustomerStatus;
  /** Localised status. */
  readonly statusLabel: string;
  /** Badge variant of the status (`D10` mapping). */
  readonly statusVariant: BadgeVariant;
  /** Primary contact's name, or the “no contact” copy. */
  readonly primaryContactText: string;
  /** Formatted last activity, or the empty-value placeholder. */
  readonly lastActivityText: string;
  /** `true` when the row is missing its tax number or its registered address. */
  readonly hasMissingData: boolean;
}

/** The mapped rows of one page, in server order. */
export type CustomerRowViewModels = readonly CustomerRowViewModel[];

/** Props of {@link CustomerStatusBadge}. */
export interface CustomerStatusBadgeProps {
  /** The domain status; the component resolves label and variant from it. */
  readonly status: CustomerStatus;
}
