/**
 * The *Kapcsolattartók* tab of the customer detail page (AIS-179).
 *
 * The tab owns **no read**: the rows come from the detail payload
 * (`D-W3` — no pager, no URL list state, no second request), already mapped to
 * view models by `toCustomerContactViewModels`. What it does own is the archive
 * confirmation's target, because a confirmation has no address of its own
 * (AIS-173 exception) — every other interaction is a **link** to one of the two
 * child overlay routes.
 *
 * The table is never empty-handed: an empty list renders the empty state with the
 * create CTA, so a customer without contacts reads as “none yet”, not as a broken
 * layout.
 */

import { Badge, Button, DataTable, EmptyState, buttonVariants } from '@callback/ui';
import type { DataTableColumn } from '@callback/ui';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CONTACT_COLUMNS,
  CUSTOMER_CONTACT_NO_ROLE_LABEL,
  CUSTOMER_EMPTY_VALUE_LABEL,
} from '../../../entities/customer/customer.const.js';
import type { CustomerContactViewModel } from '../../../entities/customer/customer.interface.js';
import {
  CUSTOMER_CONTACTS_CREATE_LABEL,
  CUSTOMER_CONTACTS_EMPTY_DESCRIPTION,
  CUSTOMER_CONTACTS_EMPTY_TITLE,
  CUSTOMER_CONTACTS_TABLE_CAPTION,
  CUSTOMER_CONTACT_ARCHIVE_LABEL,
  CUSTOMER_CONTACT_EDIT_LABEL,
  toCustomerContactCreateRoute,
  toCustomerContactEditRoute,
} from '../customers.const.js';
import type { CustomerTabPanelProps } from '../customers.interface.js';
import { ContactArchiveDialog } from './ContactArchiveDialog.js';

/**
 * @param props - see {@link CustomerTabPanelProps}; `customer.contacts` is
 * already mapped and `customer.id` is the address of the two overlays.
 */
export function CustomerContactsTab({ customer }: CustomerTabPanelProps) {
  const navigate = useNavigate();
  const [archiveTarget, setArchiveTarget] =
    useState<CustomerContactViewModel | null>(null);

  const columns: readonly DataTableColumn<CustomerContactViewModel>[] = [
    {
      id: 'name',
      header: CONTACT_COLUMNS.name,
      cell: (contact) => contact.name,
    },
    {
      id: 'position',
      header: CONTACT_COLUMNS.position,
      cell: (contact) => contact.positionText,
    },
    {
      id: 'email',
      header: CONTACT_COLUMNS.email,
      cell: (contact) => contact.emailText,
    },
    {
      id: 'phone',
      header: CONTACT_COLUMNS.phone,
      cell: (contact) => contact.phoneText,
    },
    {
      id: 'roles',
      header: CONTACT_COLUMNS.roles,
      cell: (contact) =>
        contact.roleBadges.length === 0 ? (
          <span className="text-text-muted">
            {CUSTOMER_CONTACT_NO_ROLE_LABEL}
          </span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {contact.roleBadges.map((badge) => (
              <Badge key={badge.role} variant={badge.variant}>
                {badge.label}
              </Badge>
            ))}
          </span>
        ),
    },
    {
      id: 'loginUser',
      header: CONTACT_COLUMNS.loginUser,
      cell: (contact) => contact.loginUserText ?? CUSTOMER_EMPTY_VALUE_LABEL,
    },
    {
      id: 'active',
      header: CONTACT_COLUMNS.active,
      cell: (contact) => contact.activeText,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          to={toCustomerContactCreateRoute(customer.id)}
          className={buttonVariants({ size: 'sm' })}
        >
          {CUSTOMER_CONTACTS_CREATE_LABEL}
        </Link>
      </div>

      <DataTable
        rows={customer.contacts}
        columns={columns}
        rowKey={(contact) => contact.id}
        caption={CUSTOMER_CONTACTS_TABLE_CAPTION}
        rowActions={(contact) => (
          <div className="flex items-center justify-end gap-2">
            <Link
              to={toCustomerContactEditRoute(customer.id, contact.id)}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              {CUSTOMER_CONTACT_EDIT_LABEL}
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setArchiveTarget(contact);
              }}
            >
              {CUSTOMER_CONTACT_ARCHIVE_LABEL}
            </Button>
          </div>
        )}
        empty={
          <EmptyState
            title={CUSTOMER_CONTACTS_EMPTY_TITLE}
            description={CUSTOMER_CONTACTS_EMPTY_DESCRIPTION}
            action={{
              label: CUSTOMER_CONTACTS_CREATE_LABEL,
              onAction: () => {
                navigate(toCustomerContactCreateRoute(customer.id));
              },
            }}
          />
        }
      />

      {archiveTarget === null ? null : (
        <ContactArchiveDialog
          customerId={customer.id}
          contact={archiveTarget}
          onClose={() => {
            setArchiveTarget(null);
          }}
        />
      )}
    </div>
  );
}
