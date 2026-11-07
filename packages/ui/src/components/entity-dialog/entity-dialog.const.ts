/**
 * Texts and layout classes of {@link EntityDialog} (AIS-155).
 *
 * The entity overlay is the standard window of every create/edit form, so its
 * two button labels are defaults that a caller overrides only when the entity
 * needs different wording.
 */

/** Default label of the dismiss button — closing the overlay changes nothing. */
export const ENTITY_DIALOG_CANCEL_LABEL = 'Mégsem';

/**
 * Body recipe: the only scroll container of the overlay.
 *
 * `min-h-0` is what allows a flex child to shrink below its content height, so
 * `overflow-y-auto` can actually engage; without it a long form would push the
 * footer out of the viewport instead of scrolling (AIS-155 `D3`).
 */
export const ENTITY_DIALOG_BODY_CLASS = 'min-h-0 flex-1 overflow-y-auto';

/**
 * Footer recipe: extras on the left, the dismiss/submit pair on the right.
 *
 * `w-full` because the shell wraps the footer in a `justify-end` row; the two
 * groups then keep their places regardless of which extras are present.
 */
export const ENTITY_DIALOG_FOOTER_CLASS =
  'flex w-full flex-wrap items-center justify-between gap-2';

/** Group holding the dismiss and the submit button, aligned to the right. */
export const ENTITY_DIALOG_ACTIONS_CLASS = 'ml-auto flex items-center gap-2';
