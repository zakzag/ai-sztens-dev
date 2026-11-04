import { cva, type VariantProps } from 'class-variance-authority';
import {
  DIALOG_CONTENT_Z_INDEX,
  DIALOG_OVERLAY_Z_INDEX,
} from './dialog.const.js';

/**
 * Backdrop recipe: a full-viewport dimming surface below the panel.
 *
 * The dimmer uses the sunken surface token plus `opacity-80` instead of a
 * black literal, so the overlay stays inside the token vocabulary.
 */
export const dialogOverlayVariants = cva(
  `fixed inset-0 ${DIALOG_OVERLAY_Z_INDEX} bg-surface-sunken opacity-80`,
);

/**
 * Surface recipe of {@link Dialog}: a centred raised card.
 *
 * The recipe carries layout, shape, border colour, surface, depth and the focus
 * ring; the `size` variant only changes the maximum width.
 */
export const dialogVariants = cva(
  `fixed left-1/2 top-1/2 ${DIALOG_CONTENT_Z_INDEX} flex w-full -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-card border border-hairline border-border-hairline bg-surface-raised p-6 shadow-neu-raised focus-visible:outline-none`,
  {
    variants: {
      size: {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-2xl',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export type DialogVariants = VariantProps<typeof dialogVariants>;

/** The width presets of {@link Dialog}. */
export type DialogSize = NonNullable<DialogVariants['size']>;
