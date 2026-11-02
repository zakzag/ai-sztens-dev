/**
 * The URL-owned list-params hook (AIS-119).
 *
 * A list's filter, sort and page live **in the URL**, not in a store: the link
 * is copyable, back/forward works, and a reload keeps the same view. The hook
 * reads the search params through the resource's zod schema, so an invalid
 * value silently falls back to the schema default (never an empty page), and
 * writes changes back with the defaults left out of the URL.
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
import {
  applyPageReset,
  parseListParams,
  parseListParamsDefaults,
  toListParamsDefaults,
  toListParamsUrlSearchParams,
} from './use-list-params.logic.js';

/**
 * @param schema - the list-query schema of the resource.
 * @returns the parsed query plus `setParam` and `resetParams`.
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

    setSearchParams(
      toListParamsUrlSearchParams(next, toListParamsDefaults(next)),
      { replace: false },
    );
  };

  const resetParams = (): void => {
    setSearchParams({}, { replace: true });
  };

  return { params, setParam, resetParams };
}
