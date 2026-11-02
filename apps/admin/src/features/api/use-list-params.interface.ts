/**
 * Types of the URL-owned list-params hook (AIS-119).
 *
 * The hook is resource-agnostic: the caller supplies its list-query schema —
 * the shared base `listQuerySchema`, or its own `createListQuerySchema([...])` —
 * and gets back the typed query plus two functions that read and write the URL.
 */

import type { z } from 'zod';
import type { ListQuery } from '@callback/shared';

/**
 * The parsed list query the hook understands.
 *
 * `sort` is optional because the base `listQuerySchema` does not carry it; only
 * the resource-specific `createListQuerySchema([...])` does.
 */
export type ListParams = ListQuery & { readonly sort?: string };

/**
 * A zod schema that parses a list query out of a flat record of URL params.
 *
 * Mirrors the shared contract's own convention (`successEnvelopeSchema<T>`):
 * parameterised over the **output** type with an `unknown` input, because what
 * gets parsed is the raw `Record<string, string>` of the search params.
 */
export type ListParamsSchema<TParams extends ListParams> = z.ZodType<
  TParams,
  z.ZodTypeDef,
  unknown
>;

/** What {@link useListParams} returns. */
export interface UseListParamsResult<TParams extends ListParams> {
  /** The parsed, defaulted query — memoised on the search string. */
  readonly params: TParams;
  /** Writes one field back to the URL; a non-`page` change resets `page` to 1. */
  readonly setParam: <K extends keyof TParams>(
    name: K,
    value: TParams[K],
  ) => void;
  /** Removes every list param from the URL (defaults stay implied). */
  readonly resetParams: () => void;
}
