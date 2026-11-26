/**
 * Which component renders each tab of the customer detail page (AIS-20).
 *
 * A **total** `Record` over the closed `CustomerTab` union, not a `switch` with a
 * `default`: a seventh tab added to `CUSTOMER_TAB_VALUES` fails the build here
 * until somebody decides what it renders. That is also what let AIS-179 and AIS-181
 * land their tabs by editing **this file only** — the page itself never learns how
 * many tabs exist or what they read.
 *
 * The two AIS-181 entries are the first ones with a read of their own: the feed and
 * the ledger are separate paged endpoints, so their components own their
 * `useListParams` state and their own four UI states.
 */

import type { ComponentType } from 'react';
import type { CustomerTab, CustomerTabPanelProps } from '../customers.interface.js';
import { CustomerActivityTab } from './CustomerActivityTab.js';
import { CustomerAuditTab } from './CustomerAuditTab.js';
import { CustomerContactsTab } from './CustomerContactsTab.js';
import { CustomerDataTab } from './CustomerDataTab.js';
import { CustomerOverviewTab } from './CustomerOverviewTab.js';
import { CustomerUsersTab } from './CustomerUsersTab.js';

/** The panel of every tab, keyed by the `?tab=` value. */
export const CUSTOMER_TAB_PANELS: Readonly<
  Record<CustomerTab, ComponentType<CustomerTabPanelProps>>
> = {
  overview: CustomerOverviewTab,
  data: CustomerDataTab,
  // AIS-179: both tabs read the detail payload, so they need no page change.
  contacts: CustomerContactsTab,
  users: CustomerUsersTab,
  // AIS-181: two paged reads of their own (feed and ledger).
  activity: CustomerActivityTab,
  audit: CustomerAuditTab,
};
