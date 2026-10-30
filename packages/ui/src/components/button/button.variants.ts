import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Visual recipes for {@link Button}. The base string carries layout, shape,
 * border width **and border colour**, motion and focus tokens; the variants
 * only swap surfaces.
 *
 * `border-border-hairline` is explicit on purpose: Tailwind v4 leaves
 * `border-color` at `currentColor`, which painted the outline with the
 * near-white text token. Borders are dark tokens only.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-control border border-hairline border-border-hairline font-medium transition-shadow duration-fast focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-neu-raised hover:bg-primary-hover',
        secondary:
          'bg-surface-raised text-text-primary shadow-neu-raised hover:shadow-neu-pressed',
        ghost:
          'border-transparent bg-transparent text-text-secondary shadow-none hover:text-text-primary',
        danger:
          'bg-danger text-danger-foreground shadow-neu-raised hover:shadow-neu-pressed',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
