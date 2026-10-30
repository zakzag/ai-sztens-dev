import type { ReactNode } from 'react';

/** Props of {@link AppErrorBoundary}. */
export interface AppErrorBoundaryProps {
  /** The subtree to protect. */
  readonly children: ReactNode;

  /** Title of the error state. */
  readonly title?: string;

  /** Message of the error state. */
  readonly message?: string;

  /** Label of the reload button. */
  readonly reloadLabel?: string;
}
