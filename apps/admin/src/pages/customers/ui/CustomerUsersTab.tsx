/**
 * The *Felhasználók* tab of the customer detail page (AIS-179).
 *
 * Like the contacts tab it reads the **detail payload** (`D-W3`): the contract has
 * no `listCustomerUsers` operation, so there is no pager and no URL list state —
 * the rows are `customer.customerUsers`, already mapped.
 *
 * Two behaviours worth keeping:
 *
 * - the revoke action is rendered **only** on `invited` rows (`D8`): the API
 *   revokes pending invitations and answers `422` for anything else, so showing the
 *   action on an active row would promise a write the server refuses;
 * - the invite CTA is a link to `/customers/:id/users/invite`, i.e. the surface has
 *   an address and survives a reload.
 */

import {
  Button,
  DataTable,
  EmptyState,
  StatusBadge,
  buttonVariants,
} from '@callback/ui';
import type { DataTableColumn } from '@callback/ui';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CUSTOMER_USER_COLUMNS } from '../../../entities/customer/customer.const.js';
import type { CustomerUserViewModel } from '../../../entities/customer/customer.interface.js';
import {
  CUSTOMER_USERS_EMPTY_DESCRIPTION,
  CUSTOMER_USERS_EMPTY_TITLE,
  CUSTOMER_USERS_INVITE_LABEL,
  CUSTOMER_USERS_TABLE_CAPTION,
  CUSTOMER_USER_EDIT_LABEL,
  CUSTOMER_USER_REVOKE_LABEL,
  toCustomerUserEditRoute,
  toCustomerUserInviteRoute,
} from '../customers.const.js';
import type { CustomerTabPanelProps } from '../customers.interface.js';
import { CustomerUserRevokeDialog } from './CustomerUserRevokeDialog.js';

/**
 * @param props - see {@link CustomerTabPanelProps}; `customer.customerUsers` is
 * already mapped and `customer.id` is the address of the two overlays.
 */
export function CustomerUsersTab({ customer }: CustomerTabPanelProps) {
  const navigate = useNavigate();
  const [revokeTarget, setRevokeTarget] =
    useState<CustomerUserViewModel | null>(null);

  const columns: readonly DataTableColumn<CustomerUserViewModel>[] = [
    {
      id: 'name',
      header: CUSTOMER_USER_COLUMNS.name,
      cell: (user) => user.name,
    },
    {
      id: 'email',
      header: CUSTOMER_USER_COLUMNS.email,
      cell: (user) => user.email,
    },
    {
      id: 'role',
      header: CUSTOMER_USER_COLUMNS.role,
      cell: (user) => user.roleLabel,
    },
    {
      id: 'status',
      header: CUSTOMER_USER_COLUMNS.status,
      cell: (user) => (
        <StatusBadge
          status={user.status}
          label={user.statusLabel}
          variant={user.statusVariant}
        />
      ),
    },
    {
      id: 'invitedAt',
      header: CUSTOMER_USER_COLUMNS.invitedAt,
      cell: (user) => user.invitedAtText,
    },
    {
      id: 'lastLogin',
      header: CUSTOMER_USER_COLUMNS.lastLogin,
      cell: (user) => user.lastLoginText,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          to={toCustomerUserInviteRoute(customer.id)}
          className={buttonVariants({ size: 'sm' })}
        >
          {CUSTOMER_USERS_INVITE_LABEL}
        </Link>
      </div>

      <DataTable
        rows={customer.customerUsers}
        columns={columns}
        rowKey={(user) => user.id}
        caption={CUSTOMER_USERS_TABLE_CAPTION}
        rowActions={(user) => (
          <div className="flex items-center justify-end gap-2">
            {user.isInvited ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setRevokeTarget(user);
                }}
              >
                {CUSTOMER_USER_REVOKE_LABEL}
              </Button>
            ) : (
              <Link
                to={toCustomerUserEditRoute(customer.id, user.id)}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                {CUSTOMER_USER_EDIT_LABEL}
              </Link>
            )}
          </div>
        )}
        empty={
          <EmptyState
            title={CUSTOMER_USERS_EMPTY_TITLE}
            description={CUSTOMER_USERS_EMPTY_DESCRIPTION}
            action={{
              label: CUSTOMER_USERS_INVITE_LABEL,
              onAction: () => {
                navigate(toCustomerUserInviteRoute(customer.id));
              },
            }}
          />
        }
      />

      {revokeTarget === null ? null : (
        <CustomerUserRevokeDialog
          customerId={customer.id}
          user={revokeTarget}
          onClose={() => {
            setRevokeTarget(null);
          }}
        />
      )}
    </div>
  );
}
