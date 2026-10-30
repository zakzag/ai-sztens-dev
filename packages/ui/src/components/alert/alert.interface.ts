import type { HTMLAttributes, ReactNode } from 'react';
import type { AlertVariants } from './alert.variants.js';

/**
 * Props of {@link Alert}.
 */
export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>, AlertVariants {
  /** Bold first line; the body stays in `children`. */
  readonly title?: string;
  readonly children?: ReactNode;
}
