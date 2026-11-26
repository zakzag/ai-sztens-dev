/**
 * Soft-delete confirmation of one activity entry (AIS-181).
 *
 * A **confirmation**, so it has no address and no route: the tab mounts it only
 * while a row is selected (AIS-173 exception, the same rule the contact archive
 * follows). The write is a soft delete — the row disappears from the feed and the
 * ledger keeps a `soft_delete` record of it, which is exactly what the description
 * tells the operator.
 *
 * A rejection is left to the global capture (the `page` tier) and the window stays
 * open, so the operator can retry without losing the selection.
 */

import { ConfirmDialog } from '@callback/ui';
import { useRemoveActivityMutation } from '../../../features/customers/use-customer-activities.js';
import {
  CUSTOMER_ACTIVITY_DELETE_CONFIRM_LABEL,
  CUSTOMER_ACTIVITY_DELETE_DIALOG_DESCRIPTION,
  CUSTOMER_ACTIVITY_DELETE_DIALOG_TITLE,
} from '../customers.const.js';
import type { CustomerActivityDeleteDialogProps } from '../customers.interface.js';

/**
 * @param props - see {@link CustomerActivityDeleteDialogProps}.
 */
export function CustomerActivityDeleteDialog({
  customerId,
  activity,
  onClose,
}: CustomerActivityDeleteDialogProps) {
  const { removeActivity, isPending } = useRemoveActivityMutation(
    customerId,
    activity.id,
  );

  const handleConfirm = (): void => {
    void removeActivity()
      .then(() => {
        onClose();
      })
      .catch(() => {
        // Already announced by the global capture; closing would hide the retry.
      });
  };

  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      title={CUSTOMER_ACTIVITY_DELETE_DIALOG_TITLE}
      description={`${activity.authorName} — ${CUSTOMER_ACTIVITY_DELETE_DIALOG_DESCRIPTION}`}
      confirmLabel={CUSTOMER_ACTIVITY_DELETE_CONFIRM_LABEL}
      isPending={isPending}
      onConfirm={handleConfirm}
    />
  );
}
