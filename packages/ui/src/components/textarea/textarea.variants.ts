import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Visual recipe for {@link Textarea}.
 *
 * Deliberately the same sunken recipe as {@link Input} — a multi-line field is
 * not a different surface, only a taller one — plus `resize-y` so the user can
 * grow it without being able to break the layout horizontally.
 */
export const textareaVariants = cva(
  'block w-full resize-y rounded-control border border-hairline bg-surface-sunken px-3 py-2 text-sm text-text-primary shadow-neu-inset transition-shadow duration-fast placeholder:text-text-muted focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:opacity-60',
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

export type TextareaVariants = VariantProps<typeof textareaVariants>;
