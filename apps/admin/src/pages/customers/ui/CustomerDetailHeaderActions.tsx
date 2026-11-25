/**
 * Write actions of the customer detail header (AIS-21).
 *
 * Three entry points, one group: the *Szerkesztés* link into the edit page and the
 * two items of an action menu — *Státusz váltása* and *Archiválás*. Both menu
 * items open a **non-navigable modal**, so their open flag is local `useState`
 * here (UI-Architecture §6.3 / AIS-173 exception): nothing links to them, nothing
 * reloads into them, and the archive confirmation already worked this way in the
 * list (AIS-19). The detail route's `children` slot therefore stays free for the
 * contact and invite overlays of AIS-179.
 *
 * One flag with three values instead of two booleans: the two dialogs are mutually
 * exclusive, and a single state makes that a fact of the type rather than an
 * invariant someone has to remember.
 *
 * The component owns no data: the record's `id`, name, status and `updatedAt`
 * arrive from the page, and a successful archive is reported upward, because only
 * the page may leave the now-dead detail view.
 */

import { Button, DropdownMenu, buttonVariants } from '@callback/ui';
import type { DropdownMenuItem } from '@callback/ui';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useArchiveCustomerMutation } from '../../../features/customers/use-archive-customer.js';
import {
  CUSTOMER_DETAIL_ACTION_IDS,
  CUSTOMER_DETAIL_ACTION_LABELS,
  CUSTOMER_DETAIL_ACTIONS_LABEL,
  CUSTOMER_DETAIL_ACTIONS_TRIGGER_LABEL,
  CUSTOMER_DETAIL_EDIT_LABEL,
} from '../customers.const.js';
import type { CustomerDetailHeaderActionsProps } from '../customers.interface.js';
import { toCustomerEditRoute } from '../customers.logic.js';
import { ArchiveCustomerDialog } from './ArchiveCustomerDialog.js';
import { CustomerStatusDialog } from './CustomerStatusDialog.js';

/** Which modal the menu asked for; `null` means none. */
type OpenDialog = 'status' | 'archive' | null;

/**
 * The window each menu item stands for.
 *
 * A `Record` instead of a `switch`: an unknown id (a future item that forgot its
 * dialog) opens nothing rather than the wrong window.
 */
const DIALOG_BY_ACTION_ID: Readonly<Record<string, OpenDialog>> = Object.freeze({
  [CUSTOMER_DETAIL_ACTION_IDS.status]: 'status',
  [CUSTOMER_DETAIL_ACTION_IDS.archive]: 'archive',
});

/**
 * @param props - see {@link CustomerDetailHeaderActionsProps}.
 */
export function CustomerDetailHeaderActions({
  customerId,
  displayName,
  status,
  updatedAt,
  onArchived,
}: CustomerDetailHeaderActionsProps) {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const { archiveCustomer, isPending } = useArchiveCustomerMutation();

  const closeDialog = (): void => {
    setOpenDialog(null);
  };

  const actions: readonly DropdownMenuItem[] = [
    {
      id: CUSTOMER_DETAIL_ACTION_IDS.status,
      label: CUSTOMER_DETAIL_ACTION_LABELS.status,
      onSelect: (id) => {
        setOpenDialog(DIALOG_BY_ACTION_ID[id] ?? null);
      },
    },
    {
      id: CUSTOMER_DETAIL_ACTION_IDS.archive,
      label: CUSTOMER_DETAIL_ACTION_LABELS.archive,
      tone: 'danger',
      onSelect: (id) => {
        setOpenDialog(DIALOG_BY_ACTION_ID[id] ?? null);
      },
    },
  ];

  /**
   * Archives the customer and leaves the page.
   *
   * A failure is **not** handled here: it is a `page`-tier failure, which the
   * global notification capture already announces (AIS-136), and the confirmation
   * must stay open so the operator can retry. Re-throwing would only produce an
   * unhandled rejection out of a `void` callback, which is why the catch is empty
   * and this comment takes its place.
   */
  const confirmArchive = async (): Promise<void> => {
    try {
      await archiveCustomer(customerId);
    } catch {
      return;
    }

    setOpenDialog(null);
    onArchived();
  };

  return (
    <div className="flex items-center gap-3">
      <Link
        to={toCustomerEditRoute(customerId)}
        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
      >
        {CUSTOMER_DETAIL_EDIT_LABEL}
      </Link>

      <DropdownMenu
        label={CUSTOMER_DETAIL_ACTIONS_LABEL}
        align="end"
        items={actions}
        trigger={
          <Button type="button" variant="ghost" size="sm">
            {CUSTOMER_DETAIL_ACTIONS_TRIGGER_LABEL}
          </Button>
        }
      />

      {openDialog === 'status' ? (
        <CustomerStatusDialog
          customerId={customerId}
          currentStatus={status}
          updatedAt={updatedAt}
          onClose={closeDialog}
        />
      ) : null}

      {openDialog === 'archive' ? (
        <ArchiveCustomerDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              closeDialog();
            }
          }}
          customerName={displayName}
          isPending={isPending}
          onConfirm={() => {
            void confirmArchive();
          }}
        />
      ) : null}
    </div>
  );
}
