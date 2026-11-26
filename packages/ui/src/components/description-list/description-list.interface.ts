import type { ReactNode } from 'react';

/**
 * One label/value pair of {@link DescriptionList}.
 *
 * `label` is also the React key, so labels must be unique inside one list — the
 * contract of a description list (a term names its data) already requires it.
 */
export interface DescriptionListItem {
  /** The term (`<dt>`). */
  readonly label: string;
  /** The description (`<dd>`) — text, a badge, a link, anything renderable. */
  readonly value: ReactNode;
}

/** Props of {@link DescriptionList}. */
export interface DescriptionListProps {
  /** The pairs, in render order. */
  readonly items: readonly DescriptionListItem[];
  /** `true` renders skeleton rows instead of values. */
  readonly isLoading?: boolean;
  /** Rendered when there is nothing to show and no loading is in flight. */
  readonly empty?: ReactNode;
  /** One column (default) or two side by side from the `sm` breakpoint. */
  readonly columns?: 1 | 2;
  /** Extra classes merged onto the wrapper. */
  readonly className?: string;
}
