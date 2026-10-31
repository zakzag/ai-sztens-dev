/**
 * The list-query contract (AIS-106).
 *
 * One validated shape for "which page, how many, sorted how, filtered by what"
 * — shared by the server (which validates the query string) and the client
 * (which builds it).
 *
 * Two exports, on purpose:
 *
 * - {@link listQuerySchema} is the **base**: everything except `sort`. The
 *   sortable columns are resource-specific (`name` for api-keys, `createdAt` for
 *   companies), so a single static schema could not constrain them.
 * - {@link createListQuerySchema} takes the allow-list from the caller, so an
 *   unknown column is a `400` and not a `500` (plan `D3`).
 *
 * The numbers are coerced because a query string is always a string: `?page=3`
 * arrives as `'3'`, and the server's `ZodQueryPipe` expects exactly this
 * (see `apps/api/src/common/http/zod.pipe.ts`).
 */

import { z } from 'zod';

/** Default page size of a list request. */
export const LIST_QUERY_DEFAULT_LIMIT = 20;

/** Largest page size a list request may ask for. */
export const LIST_QUERY_MAX_LIMIT = 100;

/** Largest length of the free-text search term. */
export const LIST_QUERY_MAX_SEARCH_LENGTH = 200;

/** The sort direction of a list request. */
export const listQueryOrderSchema = z.enum(['asc', 'desc']).default('desc');

/**
 * The `page` field — 1-based, coerced from the query string.
 *
 * The default is filled in **by the schema**, so the server does not have to
 * default it separately and the client and the server cannot disagree.
 */
export const listQueryPageSchema = z.coerce.number().int().min(1).default(1);

/**
 * The `limit` field — between 1 and {@link LIST_QUERY_MAX_LIMIT}, coerced from
 * the query string.
 *
 * The upper bound is not a protection measure: it is what makes the
 * `totalPages` arithmetic meaningful for the client's pager.
 */
export const listQueryLimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(LIST_QUERY_MAX_LIMIT)
  .default(LIST_QUERY_DEFAULT_LIMIT);

/**
 * The `q` field — the free-text search term.
 *
 * Trimmed, and an empty term is short-circuited to `undefined`: an empty
 * `q` means *no filter*, so it must not travel to the server (plan `D4`).
 */
export const listQuerySearchSchema = z
  .string()
  .trim()
  .max(LIST_QUERY_MAX_SEARCH_LENGTH)
  .optional()
  .transform((value) =>
    value === undefined || value.length === 0 ? undefined : value,
  );

/**
 * The base list-query schema — every field except `sort`.
 *
 * Use it where the sortable columns are not part of the contract yet; use
 * {@link createListQuerySchema} where they are.
 */
export const listQuerySchema = z.object({
  page: listQueryPageSchema,
  limit: listQueryLimitSchema,
  order: listQueryOrderSchema,
  q: listQuerySearchSchema,
});

/** The base list query, parsed. */
export type ListQuery = z.infer<typeof listQuerySchema>;

/**
 * Builds the list-query schema of one resource.
 *
 * The `sort` field is an **enum** over the caller's allow-list, so zod's error
 * message names the permitted values — a client that sends a typo gets a `400`
 * with the allowed set in the message, instead of a server-side `500` when the
 * value reaches the database.
 *
 * @param sortBy - the sortable columns of the resource; must not be empty.
 * @param defaultSort - the column used when the request does not specify one.
 * @returns the schema of the resource's list query.
 */
export function createListQuerySchema(
  sortBy: readonly [string, ...string[]],
  defaultSort: string = sortBy[0],
): z.ZodType<ListQuery & { readonly sort: string }, z.ZodTypeDef, unknown> {
  return listQuerySchema.extend({
    sort: z.enum(sortBy).default(defaultSort),
  });
}
