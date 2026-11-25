/**
 * The `overview` tab of the customer detail page (AIS-20).
 *
 * Basic data only — the screen contract asks for the status, its change date,
 * the primary contact and the last activity, and deliberately no widget beyond
 * that. The status row is rendered here as a `CustomerStatusBadge` instead of
 * being one of the mapper's text pairs, because a badge is a React node and the
 * mapper is pure: this is the one place the `D10` mapping reaches the DOM, and it
 * is the same component the list uses.
 *
 * The missing-data notice reuses the list's badge label as its title, so the flag
 * cannot mean one thing in the table and another on the detail page.
 */

import { Alert, DescriptionList } from '@callback/ui';
import type { DescriptionListItem } from '@callback/ui';
import { CustomerStatusBadge } from '../../../entities/customer/components/CustomerStatusBadge.js';
import {
  CUSTOMER_DETAIL_MISSING_DATA_DESCRIPTION,
  CUSTOMER_DETAIL_OVERVIEW_LABELS,
  CUSTOMER_MISSING_DATA_LABEL,
} from '../../../entities/customer/customer.const.js';
import type { CustomerTabPanelProps } from '../customers.interface.js';

/**
 * @param props - the already formatted detail view model.
 */
export function CustomerOverviewTab({ customer }: CustomerTabPanelProps) {
  const items: readonly DescriptionListItem[] = [
    {
      label: CUSTOMER_DETAIL_OVERVIEW_LABELS.status,
      value: <CustomerStatusBadge status={customer.status} />,
    },
    ...customer.overview,
  ];

  return (
    <div className="space-y-6">
      <DescriptionList items={items} columns={2} />
      {customer.hasMissingData ? (
        <Alert variant="warning" title={CUSTOMER_MISSING_DATA_LABEL}>
          {CUSTOMER_DETAIL_MISSING_DATA_DESCRIPTION}
        </Alert>
      ) : null}
    </div>
  );
}
