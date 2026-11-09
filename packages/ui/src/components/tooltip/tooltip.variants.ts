import { cva } from 'class-variance-authority';
import { SURFACE_GLASS_CLASS } from '../../theme/theme.const.js';

/**
 * Surface recipe of the tooltip panel.
 *
 * One recipe, no variants: the placement is a Radix prop (`side`, exposed as a
 * `data-side` attribute), not a class recipe, so nothing here may depend on it.
 * The overlay surface token plus the raised depth keeps the panel above the
 * page without inventing a colour.
 */
export const tooltipVariants = cva(
  `z-50 max-w-xs rounded-control border border-hairline border-border-hairline bg-surface-overlay px-2.5 py-1.5 text-xs text-text-primary shadow-neu-raised ${SURFACE_GLASS_CLASS}`,
);
