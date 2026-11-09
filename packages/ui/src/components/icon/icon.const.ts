/**
 * Base class of every icon.
 *
 * An SVG that only carries a `viewBox` has no intrinsic size and would stretch
 * to the width of its container, so the default size lives here. It is merged
 * with the caller's `className` through `cn()`, which lets a caller override
 * the size (`h-6 w-6`) while keeping the API at `className` only.
 */
export const ICON_BASE_CLASS = 'h-4 w-4 shrink-0';

/** Stroke width of the Lucide source geometry (24×24 grid, 2px stroke). */
export const ICON_STROKE_WIDTH = 2;

/** Viewbox of the Lucide source geometry every icon is drawn on. */
export const ICON_VIEW_BOX = '0 0 24 24';
