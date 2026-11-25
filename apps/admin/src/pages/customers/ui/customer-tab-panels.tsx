/**
 * Which component renders each tab of the customer detail page (AIS-20).
 *
 * A **total** `Record` over the closed `CustomerTab` union, not a `switch` with a
 * `default`: a seventh tab added to `CUSTOMER_TAB_VALUES` fails the build here
 * until somebody decides what it renders. That is also what lets AIS-179 and
 * AIS-181 land their four tabs by editing **this file only** — the page itself
 * never learns how many tabs exist.
 *
 * The four tabs that belong to later tickets map to a shared placeholder instead
 * of being left out: an empty body would look like a customer without data, while
 * the placeholder says the tab is not there yet.
 */

import { EmptyState } from '@callback/ui';
import type { ComponentType } from 'react';
import {
  CUSTOMER_DETAIL_TAB_PLACEHOLDER_DESCRIPTION,
  CUSTOMER_DETAIL_TAB_PLACEHOLDER_TITLE,
} from '../customers.const.js';
import type { CustomerTab, CustomerTabPanelProps } from '../customers.interface.js';
import { CustomerDataTab } from './CustomerDataTab.js';
import { CustomerOverviewTab } from './CustomerOverviewTab.js';

/**
 * Body of a tab whose content is owned by a later ticket (AIS-179 / AIS-181).
 *
 * Deliberately prop-free: it renders the same notice whichever of the four tabs
 * is open, and the active tab is already named by the strip's `aria-current`.
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
  contacts: CustomerTabPlaceholder,
  users: CustomerTabPlaceholder,
  activity: CustomerTabPlaceholder,
  audit: CustomerTabPlaceholder,
};
