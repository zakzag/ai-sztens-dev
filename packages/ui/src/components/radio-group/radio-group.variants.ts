import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Visual recipe for a single radio input of {@link RadioGroup}.
 *
 * Identical token set to `Checkbox` (`accent-primary` is the only portable way
 * to colour a native radio), so the two primitives cannot drift apart.
 */
export const radioVariants = cva(
  'mt-0.5 size-4 shrink-0 accent-primary transition-shadow duration-fast focus-visible:outline-none focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      invalid: {
        true: 'outline outline-danger',
        false: '',
      },
    },
    defaultVariants: { invalid: false },
  },
);

export type RadioVariants = VariantProps<typeof radioVariants>;
