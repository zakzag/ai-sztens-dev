/**
 * Pure rules of the URL-owned list-params hook (AIS-119).
 *
 * No React, no router, no I/O: everything here is unit-testable with plain
 * values, so the fallback behaviour (invalid param → default) and the
 * default-omitting URL builder are verified without mounting a router.
 */

import { toListQueryParams, type ListQueryDefaults } from '@callback/shared';
import {
  LIST_PARAMS_DEFAULT_PAGE,
  LIST_PARAMS_NO_DEFAULTS_MESSAGE,
  LIST_PARAMS_PAGE_FIELD,
} from './use-list-params.const.js';
import type {
  ListParams,
  ListParamsSchema,
} from './use-list-params.interface.js';

/**
 * The impossible-case failure: the schema cannot default an empty URL.
 *
 * Every real list-query schema defaults all of its fields (`listQuerySchema`
 * and `createListQuerySchema([...])` both do), so reaching this means the
 * caller passed something that is not a list query — a programming error, not
 * user input, which is why it throws instead of silently returning garbage.
 */
export class ListParamsError extends Error {
  constructor() {
    super(LIST_PARAMS_NO_DEFAULTS_MESSAGE);
    this.name = 'ListParamsError';
  }
}

/**
 * Parses the URL search params, falling back to the schema defaults on any
 * invalid value.
 *
 * The DoD requires “no throw, no empty page”: an invalid `?limit=999` or
 * `?page=abc` must not blow up the render. The whole candidate is therefore
 * parsed with `safeParse`, and on failure the **empty record** is parsed
 * instead — the schema's own `default()` then produces the canonical values.
 *
 * @param schema - the list-query schema of the resource.
 * @param searchParams - the current URL search params.
 * @returns the parsed query, always defaulted.
 */
export function parseListParams<TParams extends ListParams>(
  schema: ListParamsSchema<TParams>,
  searchParams: URLSearchParams,
): TParams {
  const candidate = Object.fromEntries(searchParams.entries());
  const parsed = schema.safeParse(candidate);

  if (parsed.success) {
    return parsed.data;
  }

  return parseListParamsDefaults(schema);
}

/**
 * The values every field takes on an empty URL — the canonical defaults.
 *
 * @param schema - the list-query schema of the resource.
 * @returns the defaulted query.
 * @throws {@link ListParamsError} when the schema cannot default an empty
 *   record (see the class doc for why that is a programming error).
 */
export function parseListParamsDefaults<TParams extends ListParams>(
  schema: ListParamsSchema<TParams>,
): TParams {
  const parsed = schema.safeParse({});

  if (!parsed.success) {
    throw new ListParamsError();
  }

  return parsed.data;
}

/**
 * Extracts the URL-building defaults from a parsed query.
 *
 * `toListQueryParams` compares `limit` / `order` / `sort` against these, so the
 * defaults must come from the same schema that parsed the query — never from a
 * constant, or the base schema and a resource schema would disagree.
 *
 * @param params - a parsed query (typically the defaults themselves).
 * @returns the defaults `toListQueryParams` compares against.
 */
export function toListParamsDefaults<TParams extends ListParams>(
  params: TParams,
): ListQueryDefaults {
  return {
    limit: params.limit,
    order: params.order,
    ...(params.sort === undefined ? {} : { sort: params.sort }),
  };
}

/**
 * Resets the page to 1 whenever a field other than `page` changes.
 *
 * A changed filter (or sort, or search term) means the first page; changing the
 * page itself is the one change that must not reset it.
 *
 * @param params - the candidate query after the change.
 * @param changedName - the field that changed.
 * @returns the query with the page reset where required.
 */
export function applyPageReset<TParams extends ListParams>(
  params: TParams,
  changedName: string,
): TParams {
  if (changedName === LIST_PARAMS_PAGE_FIELD) {
    return params;
  }

  return { ...params, page: LIST_PARAMS_DEFAULT_PAGE };
}

/**
 * Applies a **multi-field** patch in one step (AIS-116 decision D4).
 *
 * A sort header click changes two fields at once (`sort` and `order`). Two
 * consecutive single-field writes would build the second URL from the stale
 * query of the first render, so the first field would be lost — and the browser
 * would also get two history entries for one interaction. This function is the
 * merge, so the hook can perform exactly one `setSearchParams` call.
 *
 * The returned object is a fresh one; neither input is mutated.
 *
 * @param params - the current query.
 * @param patch - the fields to change.
 * @param pageField - the query field that is a page number; defaults to
 *   {@link LIST_PARAMS_PAGE_FIELD}.
 * @returns the query with the patch applied and the page reset where required.
 */
export function applyListParamsPatch<TParams extends ListParams>(
  params: TParams,
  patch: Partial<TParams>,
  pageField: string = LIST_PARAMS_PAGE_FIELD,
): TParams {
  // The generic spread cannot be narrowed into a concrete `page` override without
  // a cast; `page` is a known member of `ListParams`, so the cast here restates
  // what the type parameter already guarantees.
  const merged = { ...params, ...patch } as TParams;
  const onlyPageChanged = Object.keys(patch).every((name) => name === pageField);

  if (onlyPageChanged) {
    return merged;
  }

  return { ...merged, page: LIST_PARAMS_DEFAULT_PAGE } as TParams;
}

/**
 * Puts the patched fields back to their schema defaults.
 *
 * Used when the merged candidate failed the schema: plan D5 says an invalid
 * value is *dropped* (the field returns to its default), never thrown, and never
 * left in the URL in a state the server would reject.
 *
 * @param params - the current query (the untouched fields).
 * @param patch - the fields that were attempted.
 * @param defaults - the schema defaults every field falls back to.
 * @returns the query with the patched fields defaulted.
 */
export function applyPatchDefaults<TParams extends ListParams>(
  params: TParams,
  patch: Partial<TParams>,
  defaults: TParams,
): TParams {
  const fallback: Partial<TParams> = {};

  for (const name of Object.keys(patch) as (keyof TParams)[]) {
    fallback[name] = defaults[name];
  }

  return { ...params, ...fallback };
}

/**
 * Serialises a parsed query into URL search params, omitting the defaults.
 *
 * @param params - the query to write.
 * @param defaults - the values that count as “unchanged”.
 * @returns the search params for the URL.
 */
export function toListParamsUrlSearchParams<TParams extends ListParams>(
  params: TParams,
  defaults: ListQueryDefaults,
): URLSearchParams {
  return toListQueryParams(params, defaults);
}
