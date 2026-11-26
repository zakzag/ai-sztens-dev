/**
 * Default accessible name of the close control.
 *
 * A bare "×" would be unreadable for a screen reader, so the glyph is
 * `aria-hidden` and this string is the label.
 */
export const DIALOG_CLOSE_LABEL = 'Bezárás';

/**
 * Stacking class of the backdrop.
 *
 * Overlay depth is **layout**, not colour: `theme.css` has no z-scale token and
 * the palette gate does not cover it (AIS-117 decision D5). The literal lives
 * here so no JSX repeats it.
 */
export const DIALOG_OVERLAY_Z_INDEX = 'z-40';

/** Stacking class of the dialog surface; always above the backdrop. */
export const DIALOG_CONTENT_Z_INDEX = 'z-50';
