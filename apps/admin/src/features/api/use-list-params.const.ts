/**
 * Constants of the URL-owned list-params hook (AIS-119).
 *
 * The literals are exported once so the pure logic, the hook and the tests all
 * refer to the same field name and the same default page — a typo in one of
 * them would silently change the URL contract.
 */

/** The query field that is a page number. */
export const LIST_PARAMS_PAGE_FIELD = 'page';

/** The page number every non-`page` change resets back to. */
export const LIST_PARAMS_DEFAULT_PAGE = 1;

/**
 * Message of the impossible-case parse failure.
 *
 * Reached only when the caller passed a schema that cannot default an empty
 * record — a programming error, never user input.
 */
export const LIST_PARAMS_NO_DEFAULTS_MESSAGE =
  'useListParams: the schema must default every field so an empty URL parses';
