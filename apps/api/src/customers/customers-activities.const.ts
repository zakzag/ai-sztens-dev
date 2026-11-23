/**
 * Server-side constants of the customer-activities feature (AIS-178, slice f).
 *
 * Only what the **server** needs lives here: the DI token, the route segment and
 * the audited table name. Every limit and value set is defined once in
 * `@callback/shared` and enforced by the shared zod schemas (`createActivitySchema`,
 * `updateActivitySchema`, `activityListQuerySchema`), so nothing is duplicated
 * here.
 */

/**
 * DI token of the {@link CustomerActivitiesRepository} implementation.
 *
 * A string token (not the class) is what makes the service depend on the
 * *interface*: the module binds the Drizzle implementation here, while the
 * service spec injects a plain object without Nest.
 */
export const CUSTOMER_ACTIVITIES_REPOSITORY = 'CUSTOMER_ACTIVITIES_REPOSITORY';

/**
 * Controller route segment of the activity feed.
 *
 * The global prefix (`api`, see `main.ts`) turns this into
 * `/api/admin/customers/:id/activities` — exactly the paths the registry
 * publishes as `customers.listActivities` / `customers.createActivity`
 * (and, with `:activityId` appended, `updateActivity` / `removeActivity`).
 */
export const CUSTOMER_ACTIVITIES_ROUTE = 'admin/customers/:id/activities';

/**
 * The audited table of the feed.
 *
 * It is also the value the ledger stores in `audit_logs.table_name`, because
 * `AUDIT_TABLE_NAMES` (which lists this table) and this constant name the same
 * table from two sides: one writes, the other is audited.
 */
export const ACTIVITIES_TABLE_NAME = 'activities';
