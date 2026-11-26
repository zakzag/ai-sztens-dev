import { cva, type VariantProps } from 'class-variance-authority';
import { SURFACE_GLASS_CLASS } from '../../theme/theme.const.js';
import { DIALOG_CONTENT_Z_INDEX } from '../dialog/dialog.const.js';

/**
 * Surface recipe of {@link Drawer}: a full-height panel pinned to one edge.
 *
 * The `side` variant only moves the panel and rounds the inner corners; the
 * surface, border colour, depth and focus ring stay identical to `Dialog`, so
 * the two overlays cannot drift apart visually.
 */
export const drawerVariants = cva(
  `fixed top-0 bottom-0 ${DIALOG_CONTENT_Z_INDEX} flex w-full max-w-md flex-col gap-4 border border-hairline border-border-hairline bg-surface-raised p-6 shadow-neu-raised ${SURFACE_GLASS_CLASS} focus-visible:outline-none`,
  {
    variants: {
      side: {
        right: 'right-0 rounded-l-card',
        left: 'left-0 rounded-r-card',
      },
    },
    defaultVariants: { side: 'right' },
  },
);

export type DrawerVariants = VariantProps<typeof drawerVariants>;

/** Which edge the drawer is attached to. */
export type DrawerSide = NonNullable<DrawerVariants['side']>;
