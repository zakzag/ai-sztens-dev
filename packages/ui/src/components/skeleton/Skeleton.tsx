import type { SkeletonProps } from './skeleton.interface.js';
import { skeletonVariants } from './skeleton.variants.js';
import { cn } from '../../lib/cn.js';

/** Smallest placeholder count that still reads as “something is loading”. */
const MIN_SKELETON_LINES = 1;

/**
 * Loading placeholder.
 *
 * Announced state lives on the *container* of a loading region (a `Spinner` or a
 * `role="status"` message), never on the placeholders themselves — that is why
 * the whole tree is `aria-hidden`. Screen readers then hear “loading” once
 * instead of one meaningless box per shape.
 *
 * @param props - see {@link SkeletonProps}.
 */
export function Skeleton({ shape, lines, className }: SkeletonProps) {
  const count = Math.max(MIN_SKELETON_LINES, Math.trunc(lines ?? MIN_SKELETON_LINES));
  const slots = Array.from({ length: count }, (_, index) => index);

  return (
    <div aria-hidden="true" className={cn('flex flex-col gap-2', className)}>
      {slots.map((slot) => (
        <div key={slot} className={skeletonVariants({ shape })} />
      ))}
    </div>
  );
}
