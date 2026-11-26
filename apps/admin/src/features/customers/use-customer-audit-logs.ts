/**
 * Read-only access to one customer's audit ledger (AIS-181).
 *
 * **There is no mutation in this file, and there must never be one.** The ledger
 * is append-only: `AuditWriter` is the only writer, the database refuses `UPDATE`
 * and `DELETE` with triggers (AIS-177), and the api-client deliberately exposes
 * no write counterpart for `auditLogListSchema`. The Napló tab's “no mutating
 * action” requirement is therefore a property of the module graph rather than of
 * a `disabled` flag.
 *
 * The query is part of the key, so a page or filter change produces a new cache
 * entry; rows stay in the cache and are never copied into a store.
 */

import type { AuditLog, AuditLogListQuery } from '@callback/shared';
import { useApiList } from '../api/use-api-list.js';
import { customersService } from '../../services/api-client.js';
import {
  CUSTOMER_AUDIT_LOGS_QUERY_KEYS,
  EMPTY_AUDIT_LOG_LIST,
} from './customers.const.js';
import type { CustomerAuditLogsResult } from './customers.interface.js';

/**
 * Reads one page of the customer's audit log.
 *
 * @param customerId - the customer's uuid, i.e. the detail route's `:id`.
 * @param query - the validated ledger query (`page`, `limit`, `order` plus the
 *   four filters `tableName`, `operation`, `actorId`, `from`, `to`).
 * @returns the rows, the envelope `meta` and the four UI states.
 */
export function useCustomerAuditLogs(
  customerId: string,
  query: AuditLogListQuery,
): CustomerAuditLogsResult {
  const { data: auditLogs, ...listState } = useApiList<readonly AuditLog[]>({
    queryKey: CUSTOMER_AUDIT_LOGS_QUERY_KEYS.list(customerId, query),
    queryFn: () => customersService.listAuditLogs(customerId, query),
    emptyData: EMPTY_AUDIT_LOG_LIST,
    enabled: customerId !== '',
  });

  return { auditLogs, ...listState };
}
