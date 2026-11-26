/**
 * Horizontal placement of the action row.
 *
 * `end` is the form convention (submit on the reading-end side); `start` exists
 * for dialogs and inline editors where the buttons sit under a short field.
 */
export type FormActionsAlign = 'start' | 'end';

/**
 * Props of {@link FormActions}.
 *
 * The submit button is always `type="submit"`: the whole point of the primitive
 * is that no caller has to remember the explicit opt-in `Button` requires.
 */
export interface FormActionsProps {
  /** Label of the submit button, defaults to `FORM_ACTIONS_SUBMIT_LABEL`. */
  readonly submitLabel?: string;
  /** Label of the cancel button, defaults to `FORM_ACTIONS_CANCEL_LABEL`. */
  readonly cancelLabel?: string;
  /** Renders a cancel button when provided; omit it for a submit-only form. */
  readonly onCancel?: () => void;
  /** Disables both buttons, marks the submit button busy. */
  readonly isSubmitting?: boolean;
  /** Button row alignment, defaults to `end`. */
  readonly align?: FormActionsAlign;
}
