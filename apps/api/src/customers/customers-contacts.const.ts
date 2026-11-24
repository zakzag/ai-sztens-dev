/**
 * Server-side constants of the customer-contacts feature (AIS-178, slice d).
 *
 * Only what the **server** needs lives here: the DI token, the route segment, the
 * two constraint names and the audited table names. Every limit and value set is
 * defined once in `@callback/shared` and enforced by the shared zod schemas, so
 * nothing is duplicated here.
 */

/**
 * DI token of the {@link CustomerContactsRepository} implementation.
 *
 * A string token (not the class) is what makes the service depend on the
 * *interface*: the module binds the Drizzle implementation here, while the
 * service spec injects a plain mock object without Nest.
 */
export const CUSTOMER_CONTACTS_REPOSITORY = 'CUSTOMER_CONTACTS_REPOSITORY';

/**
 * Controller route segment of the contact collection.
 *
 * The global prefix (`api`, see `main.ts`) turns this into
 * `/api/admin/customers/:id/contacts` — exactly the path the registry publishes
 * as `customers.listContacts` / `customers.createContact`.
 */
export const CUSTOMER_CONTACTS_ROUTE = 'admin/customers/:id/contacts';

/**
 * Name of the **partial unique index** that allows one `primary` contact.
 *
 * `(customer_id) WHERE role = 'primary'` (migration `0005`). Classifying by index
 * name is the only honest way to map the violation: a pre-check would have to
 * repeat the partial predicate, and would still race with a concurrent write.
 */
export const CONTACT_PRIMARY_ROLE_CONSTRAINT = 'contact_roles_primary_key';

/**
 * Name of the composite foreign key that keeps a contact inside its customer.
 *
 * `(customer_id, customer_user_id) → iam.customer_users(customer_id, id)`. When
 * it rejects a write, the payload points at a login user of **another** customer
 * → `422 SEMANTIC_VALIDATION_FAILED` (AIS-178/d `D5`).
 */
export const CONTACT_USER_FK_CONSTRAINT = 'contacts_customer_user_id_fkey';

/** The audited table of the contact row itself. */
export const CONTACTS_TABLE_NAME = 'contacts';

/** The audited table of the role rows. */
export const CONTACT_ROLES_TABLE_NAME = 'contact_roles';

/** The single role that may exist at most once per customer. */
export const PRIMARY_CONTACT_ROLE = 'primary';
