/**
 * Revoke confirmation of one pending invitation (AIS-179).
 *
 * The counterpart of {@link ContactArchiveDialog}: a confirmation, so its open
 * flag is the tab's `useState` and it carries no route. It is reachable only from
 * an `invited` row, because that is the only state the API lets an operator
 * revoke (`D8`).
 */

import { ConfirmDialog } from '@callback/ui';
import { useRemoveCustomerUserMutation } from '../../../features/customers/use-customer-users.js';
import {
  CUSTOMER_USER_REVOKE_CONFIRM_DESCRIPTION,
  CUSTOMER_USER_REVOKE_CONFIRM_TITLE,
  CUSTOMER_USER_REVOKE_LABEL,
} from '../customers.const.js';
import type { CustomerUserRevokeDialogProps } from '../customers.interface.js';

/**
 * @param props - see {@link CustomerUserRevokeDialogProps}.
 */
export function CustomerUserRevokeDialog({
  customerId,
  user,
  onClose,
}: CustomerUserRevokeDialogProps) {
  const { removeCustomerUser, isPending } = useRemoveCustomerUserMutation(
    customerId,
    user.id,
  );

  const handleConfirm = (): void => {
    void removeCustomerUser()
      .then(() => {
        onClose();
      })
      .catch(() => {
        // The page-tier failure is announced by the global capture; keeping the
        // window open is what lets the operator retry.
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
      title={CUSTOMER_USER_REVOKE_CONFIRM_TITLE}
      description={`${user.name} (${user.email}) — ${CUSTOMER_USER_REVOKE_CONFIRM_DESCRIPTION}`}
      confirmLabel={CUSTOMER_USER_REVOKE_LABEL}
      isPending={isPending}
      onConfirm={handleConfirm}
    />
  );
}
