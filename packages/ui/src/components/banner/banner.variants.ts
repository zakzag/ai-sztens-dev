import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Visual recipe for {@link Banner} — the app-level, full-width strip that
 * announces a *persistent condition* (offline, expired session, maintenance).
 *
 * The accent lives on the bottom border and the surface stays
 * `--color-surface-overlay`, so the one-line strip separates from both the page
 * background and the header without a colour literal. Text keeps the primary
 * text token (like `Alert`), so WCAG AA contrast never depends on the accent.
 */
export const bannerVariants = cva(
  'flex w-full items-start justify-between gap-4 border-b border-hairline bg-surface-overlay px-4 py-2.5 text-sm shadow-neu-raised',
  {
    variants: {
      variant: {
        info: 'border-info text-text-primary',
        warning: 'border-warning text-text-primary',
        danger: 'border-danger text-text-primary',
      },
    },
    defaultVariants: { variant: 'info' },
  },
);

export type BannerVariants = VariantProps<typeof bannerVariants>;
