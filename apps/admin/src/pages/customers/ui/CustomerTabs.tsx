/**
 * The tab strip of the customer detail page (AIS-20).
 *
 * A labelled `<nav>` of `Button`s — **not** a `packages/ui` primitive and not a
 * WAI-ARIA `tablist`: every tab has an address of its own (`?tab=`), so the tabs
 * are navigation, not an in-place panel switch. `aria-current="page"` names the
 * view the URL currently shows, and the `primary` variant is the visual half of
 * the same signal, so the active tab is never colour-only.
 *
 * The strip owns no state: the tab arrives as `tab` and a click leaves through
 * `onTabChange`, which the page turns into **one** URL write.
 */

import { Button } from '@callback/ui';
import { CUSTOMER_DETAIL_TABS, CUSTOMER_DETAIL_TABS_LABEL } from '../customers.const.js';
import type { CustomerTabsProps } from '../customers.interface.js';

/**
 * @param props - see {@link CustomerTabsProps}.
 */
export function CustomerTabs({ tab, onTabChange }: CustomerTabsProps) {
  return (
    <nav aria-label={CUSTOMER_DETAIL_TABS_LABEL}>
      <ol className="flex flex-wrap items-center gap-2">
        {CUSTOMER_DETAIL_TABS.map((definition) => {
          const isActive = definition.value === tab;

          return (
            <li key={definition.value}>
              <Button
                type="button"
                size="sm"
                variant={isActive ? 'primary' : 'ghost'}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  onTabChange(definition.value);
                }}
              >
                {definition.label}
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
