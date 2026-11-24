/**
 * Server-side constants of the customer audit-log read (AIS-178, slice f).
 *
 * Only what the **server** needs lives here: the DI token and the route segment.
 * The filter values (`tableName`, `operation`, `actorId`, `from`, `to`) are
 * published by `@callback/shared` through `auditLogListQuerySchema`, so nothing is
 * duplicated here.
 *
 * Note what this file does **not** contain: a table name to audit. The ledger is
 * written by `AuditWriter` and read here; the read path owns no audited write.
 */

/**
 * DI token of the {@link CustomerAuditLogsRepository} implementation.
 *
 * A string token (not the class) is what makes the service depend on the
 * *interface*: the module binds the Drizzle implementation here, while the
 * service spec injects a plain object without Nest.
 */
export const CUSTOMER_AUDIT_LOGS_REPOSITORY = 'CUSTOMER_AUDIT_LOGS_REPOSITORY';

/**
 * Controller route segment of the ledger read.
 *
 * The global prefix (`api`, see `main.ts`) turns this into
 * `/api/admin/customers/:id/audit-logs` — exactly the path the registry publishes
 * as `customers.listAuditLogs`.
 */
export const CUSTOMER_AUDIT_LOGS_ROUTE = 'admin/customers/:id/audit-logs';
