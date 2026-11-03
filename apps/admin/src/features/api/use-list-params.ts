/**
 * The URL-owned list-params hook (AIS-119).
 *
 * A list's filter, sort and page live **in the URL**, not in a store: the link
 * is copyable, back/forward works, and a reload keeps the same view. The hook
 * reads the search params through the resource's zod schema, so an invalid
 * value silently falls back to the schema default (never an empty page), and
 * writes changes back with the defaults left out of the URL.
 *
 * Two setters, one difference (AIS-116 decision D4):
 * - `setParam(name, value)` — one field, for paging and page size;
 * - `setParams(patch)` — several fields in **one** URL write, for a sort header
 *   click that changes `sort` and `order` together. Two `setParam` calls would
 *   each rebuild the URL from the same pre-render `params`, so the first change
 *   would be lost and the browser would get two history entries.
 *
 * The hook is generic: it takes the resource's list-query schema as a
 * parameter, so `api-keys` and any future list reuse the same code. It talks to
 * no service and owns no server data — the TanStack Query hook (AIS-114)
 * consumes `params` and keeps the data in its own cache.
 */

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  ListParams,
  ListParamsSchema,
  UseListParamsResult,
} from './use-list-params.interface.js';
import { LIST_PARAMS_PAGE_FIELD } from './use-list-params.const.js';
import {
  applyListParamsPatch,
  applyPageReset,
  applyPatchDefaults,
  parseListParams,
  parseListParamsDefaults,
  toListParamsDefaults,
  toListParamsUrlSearchParams,
} from './use-list-params.logic.js';

/**
 * @param schema - the list-query schema of the resource.
 * @returns the parsed query plus `setParam`, `setParams` and `resetParams`.
 */
export function useListParams<TParams extends ListParams>(
  schema: ListParamsSchema<TParams>,
): UseListParamsResult<TParams> {
  const [searchParams, setSearchParams] = useSearchParams();

  // The parsed query is memoised on the search **string** (plan D7): a stable
  // identity is what lets a queryKey built from `params` avoid a refetch loop,
  // and the string is the exact signal “the URL changed”.
  const searchKey = searchParams.toString();
  const params = useMemo<TParams>(() => {
    return parseListParams(schema, new URLSearchParams(searchKey));
  }, [schema, searchKey]);

  const defaults = useMemo<TParams>(() => {
    return parseListParamsDefaults(schema);
  }, [schema]);

  /**
   * The single place that writes the URL, so every setter shares one rule:
   * defaults are left out and the write is a normal (non-replacing) navigation.
   *
   * The defaults compared against are the **schema** defaults (`defaults`), not
   * the candidate's own values: using the candidate would make every field look
   * “unchanged”, so `sort`, `order` and `limit` would never reach the URL
   * (AIS-116 fix of an AIS-119 defect that only showed once a sort header wrote
   * a non-default value).
   *
   * @param next - the query to serialise.
   */
  const writeParams = (next: TParams): void => {
    setSearchParams(
      toListParamsUrlSearchParams(next, toListParamsDefaults(defaults)),
      { replace: false },
    );
  };

  const setParam = <K extends keyof TParams>(
    name: K,
    value: TParams[K],
  ): void => {
    const candidate = applyPageReset<TParams>(
      { ...params, [name]: value },
      String(name),
    );
    const parsed = schema.safeParse(candidate);

    // Plan D5: an invalid value is dropped — the field returns to its schema
    // default — rather than throwing or leaving the URL in an invalid state.
    const next = parsed.success
      ? candidate
      : { ...params, [name]: defaults[name] };

    writeParams(next);
  };

  /**
   * Changes several fields with **one** URL write (AIS-116 decision D4).
   *
   * A sort header click sets `sort` and `order` together. Calling `setParam`
   * twice would build the second URL from the pre-render `params`, so the first
   * field would be silently dropped and two history entries would be created for
   * one interaction.
   */
  const setParams = (patch: Partial<TParams>): void => {
    const candidate = applyListParamsPatch(
      params,
      patch,
      LIST_PARAMS_PAGE_FIELD,
    );
    const parsed = schema.safeParse(candidate);

    writeParams(
      parsed.success
        ? candidate
        : applyPatchDefaults(params, patch, defaults),
    );
  };

  const resetParams = (): void => {
    setSearchParams({}, { replace: true });
  };

  return { params, setParam, setParams, resetParams };
}
