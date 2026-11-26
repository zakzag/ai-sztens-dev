import { Button } from '../button/Button.js';
import {
  FORM_ACTIONS_CANCEL_LABEL,
  FORM_ACTIONS_DEFAULT_ALIGN,
  FORM_ACTIONS_SUBMIT_LABEL,
} from './form-actions.const.js';
import type { FormActionsProps } from './form-actions.interface.js';

/**
 * Submit / cancel row shared by every form.
 *
 * The submit button is hard-wired to `type="submit"` and receives
 * `isLoading`, which already disables it and sets `aria-busy`; the cancel
 * button is disabled while the form is submitting so the request cannot be
 * abandoned mid-flight.
 *
 * @param props - see {@link FormActionsProps}.
 */
export function FormActions({
  submitLabel = FORM_ACTIONS_SUBMIT_LABEL,
  cancelLabel = FORM_ACTIONS_CANCEL_LABEL,
  onCancel,
  isSubmitting = false,
  align = FORM_ACTIONS_DEFAULT_ALIGN,
}: FormActionsProps) {
  return (
    <div
      className={
        align === 'end'
          ? 'flex items-center justify-end gap-2'
          : 'flex items-center justify-start gap-2'
      }
    >
      {onCancel ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {cancelLabel}
        </Button>
      ) : null}
      <Button type="submit" variant="primary" isLoading={isSubmitting}>
        {submitLabel}
      </Button>
    </div>
  );
}
