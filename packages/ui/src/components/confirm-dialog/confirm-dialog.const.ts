import type { ConfirmDialogTone } from './confirm-dialog.interface.js';

/** Default cancel label, matching the form-action vocabulary of the kit. */
export const CONFIRM_DIALOG_CANCEL_LABEL = 'Mégsem';

/**
 * Default confirm tone.
 *
 * The component is used for destructive operations, so an unopinionated default
 * would paint "delete" as the primary brand action.
 */
export const CONFIRM_DIALOG_DEFAULT_TONE: ConfirmDialogTone = 'danger';
