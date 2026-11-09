import { cva } from 'class-variance-authority';
import { SURFACE_GLASS_CLASS } from '../../theme/theme.const.js';

/**
 * Surface recipe of the dropdown panel.
 *
 * The overlay surface token, the hairline border colour and the raised depth are
 * the same as every other floating layer in the kit.
 */
export const dropdownMenuContentVariants = cva(
  `z-50 min-w-40 rounded-control border border-hairline border-border-hairline bg-surface-overlay p-1 shadow-neu-raised ${SURFACE_GLASS_CLASS}`,
);

/**
 * Recipe of one menu item.
 *
 * `data-[highlighted]` is Radix's keyboard/pointer highlight state — expressing
 * it as a class keeps the state visible without JavaScript, and the inset shadow
 * keeps the neomorphic "pressed" language. `tone` carries the only colour
 * difference: a destructive action uses the danger token.
 */
export const dropdownMenuItemVariants = cva(
  'flex cursor-pointer select-none items-center rounded-control px-3 py-1.5 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[highlighted]:bg-surface-sunken data-[highlighted]:shadow-neu-inset',
  {
    variants: {
      tone: {
        default: 'text-text-primary',
        danger: 'text-danger',
      },
    },
    defaultVariants: { tone: 'default' },
  },
);
