import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Visual recipe for {@link Alert}. The severity is carried by the thick border
 * accent, while the text keeps the primary text token so contrast does not
 * depend on the accent colour alone.
 */
export const alertVariants = cva('rounded-card border-strong bg-surface-raised px-4 py-3 text-sm shadow-neu-raised', {
  variants: {
    variant: {
      info: 'border-info text-text-primary',
      success: 'border-success text-text-primary',
      warning: 'border-warning text-text-primary',
      danger: 'border-danger text-text-primary',
    },
  },
  defaultVariants: { variant: 'info' },
});

export type AlertVariants = VariantProps<typeof alertVariants>;
