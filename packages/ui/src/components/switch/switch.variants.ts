import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Visual recipe for the track of {@link Switch}.
 *
 * The thumb is the `::after` pseudo-element: keeping it inside the track avoids
 * a second DOM node that could not react to `peer-checked`, because only the
 * track is a sibling of the visually hidden input.
 */
export const switchTrackVariants = cva(
  'inline-flex h-5 w-9 shrink-0 items-center rounded-pill border border-border-hairline bg-surface-sunken p-0.5 transition-shadow duration-fast after:h-4 after:w-4 after:rounded-full after:bg-surface-raised after:transition-transform after:duration-fast peer-checked:after:translate-x-4 peer-checked:border-border-strong peer-checked:bg-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-60 peer-focus-visible:border-border-focus peer-focus-visible:shadow-focus-ring',
);

export type SwitchVariants = VariantProps<typeof switchTrackVariants>;
