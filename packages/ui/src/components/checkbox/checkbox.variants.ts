import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Visual recipe for {@link Checkbox}.
 *
 * `accent-primary` is the only token-driven way to colour a native checkbox
 * across browsers; the border, focus ring and disabled state reuse the same
 * tokens as the other controls.
 */
export const checkboxVariants = cva(
  'size-4 shrink-0 rounded-sm border border-border-hairline bg-surface-sunken accent-primary transition-shadow duration-fast focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      invalid: {
        true: 'border-danger',
        false: '',
      },
    },
    defaultVariants: { invalid: false },
  },
);

export type CheckboxVariants = VariantProps<typeof checkboxVariants>;
