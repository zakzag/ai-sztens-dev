import { cva, type VariantProps } from 'class-variance-authority';
import { SURFACE_GLASS_CLASS } from '../../theme/theme.const.js';
import { TOAST_STACK_Z_INDEX } from './toast.const.js';

/**
 * Surface recipe for {@link Toast}.
 *
 * The severity is carried by the border accent, exactly like `Alert` and
 * `Banner`, while the text keeps `text-text-primary` so contrast never depends
 * on the accent colour alone (D5).
 *
 * The entry animation is pure CSS: the `starting:` variant supplies the initial
 * frame (`translate`, `scale`, `opacity`) and the transition animates out of it.
 * No `data-mounted` attribute and no React state are needed (D2).
 *
 * `depth` is set by {@link ToastStack}, never by a page: it pushes older cards
 * "back" so the newest one reads as the front of the pile (D6).
 */
export const toastVariants = cva(
  `pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border-strong border-border-hairline bg-surface-overlay px-4 py-3 text-sm text-text-primary shadow-neu-raised ${SURFACE_GLASS_CLASS} transition-[transform,opacity] duration-base ease-neu starting:-translate-y-2 starting:scale-95 starting:opacity-0`,
  {
    variants: {
      level: {
        success: 'border-success',
        error: 'border-danger',
        warning: 'border-warning',
        info: 'border-info',
        system: 'border-border-strong',
      },
      depth: {
        0: 'scale-100 opacity-100',
        1: 'scale-[0.97] opacity-90',
        2: 'scale-[0.94] opacity-80',
      },
    },
    defaultVariants: { level: 'info', depth: 0 },
  },
);

export type ToastVariants = VariantProps<typeof toastVariants>;

/** Position of a card in the pile: `0` is the newest. */
export type ToastDepth = NonNullable<ToastVariants['depth']>;

/**
 * Glyph chip beside the message. Same state tokens as `Badge`, so a toast and a
 * badge of the same severity cannot drift apart.
 */
export const toastLevelChipVariants = cva(
  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill text-xs font-semibold',
  {
    variants: {
      level: {
        success: 'bg-success text-success-foreground',
        error: 'bg-danger text-danger-foreground',
        warning: 'bg-warning text-warning-foreground',
        info: 'bg-info text-info-foreground',
        system: 'bg-surface-sunken text-text-secondary',
      },
    },
    defaultVariants: { level: 'info' },
  },
);

/**
 * Container recipe for {@link ToastStack}: pinned to the bottom-right corner.
 *
 * `flex-col` with a bottom anchor means DOM order is also visual order from the
 * top down, so the newest-first array renders with the newest card on top while
 * the group stays glued to the bottom edge. `pointer-events-none` keeps the
 * empty area of the container click-through; each card re-enables its own
 * pointer events.
 */
export const toastStackVariants = cva(
  `fixed bottom-4 right-4 ${TOAST_STACK_Z_INDEX} flex w-full max-w-sm flex-col items-stretch gap-2 pointer-events-none`,
);
