/**
 * Confirmation window of the archive action (AIS-19).
 *
 * The open flag is the page's local `useState` and never a route: a confirmation
 * has no address of its own (AIS-173 exception, UI-Architecture §6.3). Nothing
 * here talks to the service — the page owns the mutation and passes its state
 * down, so this component stays a decision surface.
 */

import { ConfirmDialog } from '@callback/ui';
import type { ArchiveCustomerDialogProps } from '../customers.interface.js';
import {
  CUSTOMERS_ARCHIVE_CONFIRM_DESCRIPTION,
  CUSTOMERS_ARCHIVE_CONFIRM_LABEL,
  CUSTOMERS_ARCHIVE_CONFIRM_TITLE,
} from '../customers.const.js';

/**
 * @param props - see {@link ArchiveCustomerDialogProps}.
 */
export function ArchiveCustomerDialog({
  open,
  onOpenChange,
  customerName,
  isPending,
  onConfirm,
}: ArchiveCustomerDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={CUSTOMERS_ARCHIVE_CONFIRM_TITLE}
      // The customer's name is part of the question, not of the title: the
      // title says what happens, the description says to whom.
      description={`${customerName} — ${CUSTOMERS_ARCHIVE_CONFIRM_DESCRIPTION}`}
      confirmLabel={CUSTOMERS_ARCHIVE_CONFIRM_LABEL}
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}
