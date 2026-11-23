/**
 * Server-side constants of the customer-user feature (AIS-178, slice e).
 *
 * Only what the **server** needs lives here: the DI token, the route segment, the
 * constraint names and the audited table name. Every limit and value set is
 * defined once in `@callback/shared` and enforced by the shared zod schemas.
 */

/**
 * DI token of the {@link CustomerUsersRepository} implementation.
 *
 * A string token (not the class) is what makes the service depend on the
 * *interface*: the module binds the Drizzle implementation here, while the
 * service spec injects a plain object without Nest.
 */
export const CUSTOMER_USERS_REPOSITORY = 'CUSTOMER_USERS_REPOSITORY';

/**
 * Controller route segment of the login-user collection.
 *
 * The global prefix (`api`, see `main.ts`) turns this into
 * `/api/admin/customers/:id/customer-users` — exactly the paths the registry
 * publishes as `customers.inviteCustomerUser` / `customers.updateCustomerUser` /
 * `customers.removeCustomerUser`.
 */
export const CUSTOMER_USERS_ROUTE = 'admin/customers/:id/customer-users';

/**
 * The **global**, case-insensitive unique index on the login e-mail.
 *
 * `lower(email)` without a `customer_id` component, so one address can hold at
 * most one login across every customer. Classified (never pre-checked) so the
 * answer is a `409 CUSTOMER_USER_EMAIL_CONFLICT` instead of a `500`.
 */
export const CUSTOMER_USER_EMAIL_CONSTRAINT = 'customer_users_email_key';

/**
 * The partial unique index that allows one **active `owner`** per customer.
 *
 * `(customer_id) WHERE role = 'owner' AND status = 'active'` — the predicate is
 * why the conflict surfaces at *activation* and not at invitation (AIS-178/e
 * `E5`), and why a pre-check would be wrong: only the index knows both columns.
 */
export const CUSTOMER_OWNER_CONSTRAINT = 'customer_users_customer_owner_key';

/**
 * The composite foreign key that lets a contact point at a login user.
 *
 * A `23503` on it means the user is still referenced, so the row cannot be
 * deleted without destroying that link (`409 CUSTOMER_USER_IN_USE_CONFLICT`).
 */
export const CUSTOMER_USER_CONTACT_FK_CONSTRAINT =
  'contacts_customer_user_id_fkey';

/** The foreign key an activity's author reference uses (`NO ACTION`). */
export const CUSTOMER_USER_ACTIVITY_FK_CONSTRAINT =
  'activities_customer_user_id_fkey';

/** The audited table of the login users. */
export const CUSTOMER_USERS_TABLE_NAME = 'customer_users';

/**
 * The state every invitation starts in.
 *
 * `invited`, never `active`: nobody has accepted anything yet — there is no mail
 * and no accept endpoint until the auth story lands (AIS-178/e `E10`), and a
 * freshly invited login that could authenticate would be a security hole.
 */
export const CUSTOMER_USER_INITIAL_STATUS = 'invited';

/**
 * Role used when the invitation body does not name one.
 *
 * The same value `inviteCustomerUserSchema` defaults to; duplicated here only so
 * the server has a name for it when it reads the **parsed** body, and asserted by
 * the schema tests on the shared side.
 */
export const CUSTOMER_USER_DEFAULT_ROLE = 'member';
