/**
 * The customer status badge (AIS-19).
 *
 * A thin wrapper over `StatusBadge` that takes the **domain** status and
 * resolves the label and the variant itself. The point is that the list
 * (AIS-19), the detail overview (AIS-20) and every later tab render one
 * component instead of re-implementing the `D10` mapping — the mapper stays the
 * only place the mapping exists.
 */

import { StatusBadge } from '@callback/ui';
import { CUSTOMER_STATUS_LABELS } from '../customer.const.js';
import type { CustomerStatusBadgeProps } from '../customer.interface.js';
import { toStatusVariant } from '../customer.mapper.js';

/**
 * @param props - the domain status; see {@link CustomerStatusBadgeProps}.
 */
export function CustomerStatusBadge({ status }: CustomerStatusBadgeProps) {
  return (
    <StatusBadge
      status={status}
      label={CUSTOMER_STATUS_LABELS[status]}
      variant={toStatusVariant(status)}
    />
  );
}
