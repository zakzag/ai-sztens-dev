/**
 * The `data` tab of the customer detail page (AIS-20).
 *
 * Four `Card` groups (identifiers / legal data / address / other — screen
 * contract `D12`), each one a two-column `DescriptionList`. The groups and their
 * pairs come from the mapper, so this component adds layout and nothing else: no
 * label is typed here, and a `null` field is already the placeholder copy.
 */

import { Card, DescriptionList } from '@callback/ui';
import type { CustomerTabPanelProps } from '../customers.interface.js';

/**
 * @param props - the already formatted detail view model.
 */
export function CustomerDataTab({ customer }: CustomerTabPanelProps) {
  return (
    <div className="space-y-6">
      {customer.groups.map((group) => (
        // The group title is unique inside one view model and is therefore the
        // natural React key — the same assumption `DescriptionListItem` makes
        // about its label.
        <Card key={group.title} title={group.title}>
          <DescriptionList items={group.items} columns={2} />
        </Card>
      ))}
    </div>
  );
}
