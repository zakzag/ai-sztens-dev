import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Visual recipe for {@link Skeleton}.
 *
 * Deliberately **static** (AIS-116 decision D3): the shape is drawn with the
 * sunken surface token plus an inset shadow, and there is no pulse animation,
 * because `theme.css` carries no motion token for it. Adding a pulse later means
 * extending the token set first, not inventing a duration here.
 */
export const skeletonVariants = cva(
  'rounded-control border border-hairline border-border-hairline bg-surface-sunken shadow-neu-inset',
  {
    variants: {
      shape: {
        /** One line of text. */
        line: 'h-3 w-full',
        /** The height of a form control. */
        field: 'h-9 w-full',
        /** The height of a table row. */
        row: 'h-10 w-full',
      },
    },
    defaultVariants: { shape: 'line' },
  },
);

export type SkeletonVariants = VariantProps<typeof skeletonVariants>;
