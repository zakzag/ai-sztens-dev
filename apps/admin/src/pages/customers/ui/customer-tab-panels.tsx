/**
 * Which component renders each tab of the customer detail page (AIS-20).
 *
 * A **total** `Record` over the closed `CustomerTab` union, not a `switch` with a
 * `default`: a seventh tab added to `CUSTOMER_TAB_VALUES` fails the build here
 * until somebody decides what it renders. That is also what let AIS-179 land its
 * two tabs by editing **this file only** — the page itself never learns how many
 * tabs exist.
 *
 * The two tabs that still belong to a later ticket (AIS-181) map to a shared
 * placeholder instead of being left out: an empty body would look like a customer
 * without data, while the placeholder says the tab is not there yet.
 */

import { EmptyState } from '@callback/ui';
import type { ComponentType } from 'react';
import {
  CUSTOMER_DETAIL_TAB_PLACEHOLDER_DESCRIPTION,
  CUSTOMER_DETAIL_TAB_PLACEHOLDER_TITLE,
} from '../customers.const.js';
import type { CustomerTab, CustomerTabPanelProps } from '../customers.interface.js';
import { CustomerContactsTab } from './CustomerContactsTab.js';
import { CustomerDataTab } from './CustomerDataTab.js';
import { CustomerOverviewTab } from './CustomerOverviewTab.js';
import { CustomerUsersTab } from './CustomerUsersTab.js';

/**
 * Body of a tab whose content is owned by AIS-181.
 *
 * Deliberately prop-free: it renders the same notice whichever tab is open, and
 * the active tab is already named by the strip's `aria-current`.
 */
function CustomerTabPlaceholder() {
  return (
    <EmptyState
      title={CUSTOMER_DETAIL_TAB_PLACEHOLDER_TITLE}
      description={CUSTOMER_DETAIL_TAB_PLACEHOLDER_DESCRIPTION}
    />
  );
}

/** The panel of every tab, keyed by the `?tab=` value. */
export const CUSTOMER_TAB_PANELS: Readonly<
  Record<CustomerTab, ComponentType<CustomerTabPanelProps>>
> = {
  overview: CustomerOverviewTab,
  data: CustomerDataTab,
  // AIS-179: both tabs read the detail payload, so they need no page change.
  contacts: CustomerContactsTab,
  users: CustomerUsersTab,
  activity: CustomerTabPlaceholder,
  audit: CustomerTabPlaceholder,
};
