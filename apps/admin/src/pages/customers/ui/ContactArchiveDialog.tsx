/**
 * Archive confirmation of one contact (AIS-179).
 *
 * A **confirmation**, so it has no address and no route: the tab mounts it only
 * while a row is selected, which is also what re-seeds nothing — there is no form
 * here, only a decision (AIS-173 exception).
 *
 * The mutation is bound to the customer and the contact, so the component never
 * has to pass an id around; a rejection is left to the global capture (the
 * `page` tier), and the window simply stays open so the operator can retry.
 */

import { ConfirmDialog } from '@callback/ui';
import { useRemoveContactMutation } from '../../../features/customers/use-customer-contacts.js';
import {
  CUSTOMER_CONTACT_ARCHIVE_CONFIRM_DESCRIPTION,
  CUSTOMER_CONTACT_ARCHIVE_CONFIRM_TITLE,
  CUSTOMER_CONTACT_ARCHIVE_LABEL,
} from '../customers.const.js';
import type { ContactArchiveDialogProps } from '../customers.interface.js';

/**
 * @param props - see {@link ContactArchiveDialogProps}.
 */
export function ContactArchiveDialog({
  customerId,
  contact,
  onClose,
}: ContactArchiveDialogProps) {
  const { removeContact, isPending } = useRemoveContactMutation(
    customerId,
    contact.id,
  );

  const handleConfirm = (): void => {
    void removeContact()
      .then(() => {
        onClose();
      })
      .catch(() => {
        // The failure is already announced by the global capture; closing here
        // would hide the retry affordance, so the window stays open.
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
      title={CUSTOMER_CONTACT_ARCHIVE_CONFIRM_TITLE}
      description={`${contact.name} — ${CUSTOMER_CONTACT_ARCHIVE_CONFIRM_DESCRIPTION}`}
      confirmLabel={CUSTOMER_CONTACT_ARCHIVE_LABEL}
      isPending={isPending}
      onConfirm={handleConfirm}
    />
  );
}
