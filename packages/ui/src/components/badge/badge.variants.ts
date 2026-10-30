import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Visual recipe for {@link Badge}. Variant names are the shared vocabulary
 * between domain mappers (`toStatusVariant`) and the UI.
 *
 * The outline is the dark hairline token, never `currentColor` — a badge on a
 * bright state surface must still read as a dark ring.
 */
export const badgeVariants = cva(
  'inline-flex items-center rounded-pill border border-hairline border-border-hairline px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-sunken text-text-secondary',
        info: 'bg-info text-info-foreground',
        success: 'bg-success text-success-foreground',
        warning: 'bg-warning text-warning-foreground',
        danger: 'bg-danger text-danger-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
