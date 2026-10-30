import type { HTMLAttributes, ReactNode } from 'react';
import type { BadgeVariants } from './badge.variants.js';

/**
 * Props of {@link Badge}.
 */
export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, BadgeVariants {
  readonly children?: ReactNode;
}
