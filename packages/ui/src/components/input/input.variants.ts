import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Visual recipe for {@link Input}. The sunken inset surface is the "recessed"
 * half of the neomorphic pair; the raised card is its counterpart.
 *
 * The resting outline is the dark hairline token; `invalid` and the focus ring
 * are the only states that recolour it.
 */
export const inputVariants = cva(
  'block w-full rounded-control border border-hairline border-border-hairline bg-surface-sunken px-3 py-2 text-sm text-text-primary shadow-neu-inset transition-shadow duration-fast placeholder:text-text-muted focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:opacity-60',
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

export type InputVariants = VariantProps<typeof inputVariants>;
