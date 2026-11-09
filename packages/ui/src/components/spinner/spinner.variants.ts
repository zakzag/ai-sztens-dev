import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Visual recipe for {@link Spinner}.
 *
 * The ring is drawn from border tokens only: a neutral ring plus one accent side
 * (`border-t-primary`), rotated by Tailwind's `animate-spin`. No colour literal
 * and no palette utility is involved, so the palette gate stays clean.
 */
export const spinnerVariants = cva(
  'inline-block animate-spin rounded-pill border-hairline border-border-strong border-t-primary',
  {
    variants: {
      size: {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export type SpinnerVariants = VariantProps<typeof spinnerVariants>;
