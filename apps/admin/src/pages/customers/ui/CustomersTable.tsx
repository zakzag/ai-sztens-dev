/**
 * The list part of the customers page (AIS-19).
 *
 * Renders the three data states of the table — loading (skeleton rows, header
 * kept), empty (the node the page chose) and success — and holds no state of its
 * own. The failure state belongs to the page (`PageErrorState`), because an
 * unavailable list is the page's data being unavailable, not a property of the
 * table.
 *
 * `sortable` asks the **contract's** allow-list (`CUSTOMER_SORT_FIELDS`) whether
 * the API accepts the column in `?sort=`, so the table can never offer a sort
 * the server would answer with a `400`.
 *
 * The row menu is `DropdownMenu` (AIS-117 `D8`): the three actions of AIS-17
 * `D3` are **data**, not markup, so the menu recipe exists once.
 */

import { Badge, Button, Card, DataTable, DropdownMenu } from '@callback/ui';
import type { DataTableColumn, DropdownMenuItem } from '@callback/ui';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CustomerStatusBadge } from '../../../entities/customer/components/CustomerStatusBadge.js';
import {
  CUSTOMER_MISSING_DATA_ARIA_LABEL,
  CUSTOMER_MISSING_DATA_LABEL,
  CUSTOMER_COLUMNS,
} from '../../../entities/customer/customer.const.js';
import type { CustomerRowViewModel } from '../../../entities/customer/customer.interface.js';
import { isCustomerSortable } from '../../../features/customers/customers.logic.js';
import {
  CUSTOMER_ROW_ACTION_IDS,
  CUSTOMERS_LOADING_MESSAGE,
  CUSTOMERS_ROW_ACTIONS,
  CUSTOMERS_ROW_ACTIONS_LABEL,
  CUSTOMERS_ROW_ACTIONS_TRIGGER_LABEL,
  CUSTOMERS_TABLE_TITLE,
} from '../customers.const.js';
import type { CustomersTableProps } from '../customers.interface.js';
import {
  toCustomerDetailRoute,
  toCustomerEditRoute,
} from '../customers.logic.js';

/**
 * Columns of the list, in the order the screen contract fixes.
 *
 * The name column is sortable through `legalName`: the display name is
 * `shortName ?? legalName`, and only `legalName` is guaranteed to be present on
 * every row, so it is the one the server can order deterministically.
 */
const CUSTOMER_TABLE_COLUMNS: readonly DataTableColumn<CustomerRowViewModel>[] =
  [
    {
      id: 'customerNumber',
      header: CUSTOMER_COLUMNS.customerNumber,
      cell: (customer) => (
        <span className="font-mono">{customer.customerNumber}</span>
      ),
      sortable: isCustomerSortable('customerNumber'),
    },
    {
      id: 'legalName',
      header: CUSTOMER_COLUMNS.name,
      // The row's name is the navigation into the detail page — a link, not a
      // button, so the browser's own affordances keep working.
      cell: (customer) => (
        <Link
          to={toCustomerDetailRoute(customer.id)}
          className="text-text-primary underline-offset-4 hover:underline"
        >
          {customer.displayName}
        </Link>
      ),
      sortable: isCustomerSortable('legalName'),
    },
    {
      id: 'type',
      header: CUSTOMER_COLUMNS.type,
      cell: (customer) => customer.typeLabel,
    },
    {
      id: 'taxNumber',
      header: CUSTOMER_COLUMNS.taxNumber,
      cell: (customer) => customer.taxNumberText,
    },
    {
      id: 'status',
      header: CUSTOMER_COLUMNS.status,
      cell: (customer) => <CustomerStatusBadge status={customer.status} />,
      sortable: isCustomerSortable('status'),
    },
    {
      id: 'primaryContact',
      header: CUSTOMER_COLUMNS.primaryContact,
      cell: (customer) => customer.primaryContactText,
    },
    {
      id: 'lastActivityAt',
      header: CUSTOMER_COLUMNS.lastActivity,
      cell: (customer) => customer.lastActivityText,
      sortable: isCustomerSortable('lastActivityAt'),
    },
    {
      id: 'hasMissingData',
      header: CUSTOMER_COLUMNS.missingData,
      cell: (customer) =>
        customer.hasMissingData ? (
          /*
            Severity is never colour-only: the badge carries visible text, and
            the accessible name spells out which data is missing.
          */
          <Badge variant="warning" aria-label={CUSTOMER_MISSING_DATA_ARIA_LABEL}>
            {CUSTOMER_MISSING_DATA_LABEL}
          </Badge>
        ) : null,
    },
  ];

/**
 * @param props - see {@link CustomersTableProps}.
 */
export function CustomersTable({
  customers,
  isLoading,
  sort,
  onSortChange,
  empty,
  onArchive,
  pagination,
}: CustomersTableProps) {
  const navigate = useNavigate();

  const renderRowActions = (customer: CustomerRowViewModel): ReactNode => {
    const items: readonly DropdownMenuItem[] = [
      {
        id: CUSTOMER_ROW_ACTION_IDS.open,
        label: CUSTOMERS_ROW_ACTIONS.open,
        onSelect: () => {
          navigate(toCustomerDetailRoute(customer.id));
        },
      },
      {
        id: CUSTOMER_ROW_ACTION_IDS.edit,
        label: CUSTOMERS_ROW_ACTIONS.edit,
        onSelect: () => {
          navigate(toCustomerEditRoute(customer.id));
        },
      },
      {
        id: CUSTOMER_ROW_ACTION_IDS.archive,
        label: CUSTOMERS_ROW_ACTIONS.archive,
        tone: 'danger',
        onSelect: () => {
          onArchive(customer);
        },
      },
    ];

    return (
      <DropdownMenu
        label={`${CUSTOMERS_ROW_ACTIONS_LABEL}: ${customer.displayName}`}
        trigger={
          <Button type="button" variant="ghost" size="sm">
            {CUSTOMERS_ROW_ACTIONS_TRIGGER_LABEL}
          </Button>
        }
        items={items}
      />
    );
  };

  return (
    <Card title={CUSTOMERS_TABLE_TITLE}>
      <div className="space-y-4">
        {isLoading ? (
          <p role="status" className="sr-only">
            {CUSTOMERS_LOADING_MESSAGE}
          </p>
        ) : null}
        <DataTable
          rows={customers}
          columns={CUSTOMER_TABLE_COLUMNS}
          rowKey={(customer) => customer.id}
          sort={sort}
          onSortChange={onSortChange}
          isLoading={isLoading}
          caption={CUSTOMERS_TABLE_TITLE}
          rowActions={renderRowActions}
          empty={empty}
        />
        {pagination}
      </div>
    </Card>
  );
}
