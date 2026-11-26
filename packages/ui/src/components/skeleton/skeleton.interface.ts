import type { SkeletonVariants } from './skeleton.variants.js';

/**
 * Props of {@link Skeleton}.
 *
 * A skeleton is a *placeholder*, so it carries no content and no handlers — only
 * the shape it stands in for and how many of them are needed.
 */
export interface SkeletonProps extends SkeletonVariants {
  /** How many placeholders to stack; defaults to `1`. */
  readonly lines?: number;
  /** Extra classes merged onto the wrapper (layout/spacing only). */
  readonly className?: string;
}
