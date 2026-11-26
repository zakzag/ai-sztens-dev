import { Button } from '../button/Button.js';
import { Dialog } from '../dialog/Dialog.js';
import {
  CONFIRM_DIALOG_CANCEL_LABEL,
  CONFIRM_DIALOG_DEFAULT_TONE,
} from './confirm-dialog.const.js';
import type { ConfirmDialogProps } from './confirm-dialog.interface.js';

/**
 * Confirmation dialog for a destructive decision.
 *
 * It composes {@link Dialog}, so all a11y behaviour (focus trap, `Esc`, focus
 * returned to the trigger, `aria-modal`) comes from the same place as every
 * other modal.
 *
 * AIS-117 D4: the component **only reports the decision**. Pressing the confirm
 * button calls `onConfirm` and does not close the dialog — the caller closes it
 * when its mutation succeeds. Closing immediately would make a failed request
 * erase the question the user just answered.
 *
 * @param props - see {@link ConfirmDialogProps}.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = CONFIRM_DIALOG_CANCEL_LABEL,
  tone = CONFIRM_DIALOG_DEFAULT_TONE,
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const handleOpenChange = (next: boolean): void => {
    if (!next && isPending) {
      return;
    }

    onOpenChange(next);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button
            variant="ghost"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button variant={tone} isLoading={isPending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
