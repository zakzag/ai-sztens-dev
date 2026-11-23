/**
 * Server-side constants of the customer-tags feature (AIS-178, slice e).
 *
 * Only what the **server** needs lives here: the DI token, the route segment, the
 * constraint names and the audited table names. Every limit and value set is
 * defined once in `@callback/shared` and enforced by the shared zod schemas, so
 * nothing is duplicated here.
 */

/**
 * DI token of the {@link CustomerTagsRepository} implementation.
 *
 * A string token (not the class) is what makes the service depend on the
 * *interface*: the module binds the Drizzle implementation here, while the
 * service spec injects a plain object without Nest.
 */
export const CUSTOMER_TAGS_REPOSITORY = 'CUSTOMER_TAGS_REPOSITORY';

/**
 * Controller route segment of the tag collection.
 *
 * The global prefix (`api`, see `main.ts`) turns this into
 * `/api/admin/customers/:id/tags` — exactly the paths the registry publishes as
 * `customers.createTag` / `customers.attachTag` / `customers.detachTag`.
 */
export const CUSTOMER_TAGS_ROUTE = 'admin/customers/:id/tags';

/**
 * Name of the unique constraint on the tag catalogue's `name`.
 *
 * Classified (never pre-checked) so a concurrent "create the same label" loses
 * the race as a *reusable* label instead of a `500`. The comparison is
 * case-sensitive, because the index is: `vip` and `VIP` are two labels.
 */
export const TAG_NAME_CONSTRAINT = 'tags_name_key';

/**
 * The audited table of the label catalogue.
 *
 * Note what is **not** here: the composite primary key of `customer_tags`. A
 * repeat attach violates it, and the repository deliberately neutralises that
 * with `ON CONFLICT DO NOTHING` instead of classifying it — an attach of an
 * already attached label is a no-op, not a conflict (AIS-178/e `E8`). A guard
 * constant that nobody classifies would be dead code.
 */
export const TAGS_TABLE_NAME = 'tags';

/** The audited table of the customer ⇄ tag links. */
export const CUSTOMER_TAGS_TABLE_NAME = 'customer_tags';
