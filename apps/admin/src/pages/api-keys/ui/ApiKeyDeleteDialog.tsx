import { ConfirmDialog } from '@callback/ui';
import {
  API_KEY_DELETE_CANCEL_LABEL,
  API_KEY_DELETE_CONFIRM_LABEL,
  API_KEY_DELETE_DIALOG_DESCRIPTION,
  API_KEY_DELETE_DIALOG_TITLE,
} from '../api-keys.const.js';
import type { ApiKeyDeleteDialogProps } from '../api-keys.interface.js';

/**
 * Confirmation of the destructive delete (AIS-131).
 *
 * A thin wrapper over {@link ConfirmDialog}: the primitive owns focus trapping,
 * `Esc`, overlay clicks and the “report the decision, do not act” contract
 * (AIS-117 `D4`), while this wrapper owns the copy and one rule —
 * **a failure is rendered inside the dialog**. Replacing the description with
 * the mapped error text keeps the question and its rejection in the same place;
 * closing the dialog and showing a page alert would hide the sentence behind an
 * overlay the user has already dismissed mentally.
 *
 * @param props - see {@link ApiKeyDeleteDialogProps}.
 */
export function ApiKeyDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  errorMessage,
}: ApiKeyDeleteDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={API_KEY_DELETE_DIALOG_TITLE}
      description={errorMessage ?? API_KEY_DELETE_DIALOG_DESCRIPTION}
      confirmLabel={API_KEY_DELETE_CONFIRM_LABEL}
      cancelLabel={API_KEY_DELETE_CANCEL_LABEL}
      tone="danger"
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}
