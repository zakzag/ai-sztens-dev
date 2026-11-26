/**
 * The optional call-to-action of {@link EmptyState}.
 *
 * A separate object instead of two loose props (`actionLabel` / `onAction`)
 * because the two must always travel together — a label without a handler is a
 * dead button, a handler without a label is an unlabeled one.
 */
export interface EmptyStateAction {
  /** Visible button text. */
  readonly label: string;
  /** What the button does. */
  readonly onAction: () => void;
}

/** Props of {@link EmptyState}. */
export interface EmptyStateProps {
  /** Short headline of the empty region; also its accessible name. */
  readonly title: string;
  /** Optional explanation under the headline. */
  readonly description?: string;
  /** Optional next step (e.g. “create the first item”). */
  readonly action?: EmptyStateAction;
  /** Extra classes merged onto the wrapper. */
  readonly className?: string;
}
