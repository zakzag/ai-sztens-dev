/**
 * The URL-owned tab/step reader (AIS-19).
 *
 * A component never reads `searchParams` itself (`react.coding-standards.md`
 * §6.2), and `useListParams` only knows the paging/filter/sort contract of a
 * resource. This hook fills the gap for parameters that select a **view** inside
 * one route — `?step=` on the create wizard here, `?tab=` on the customer detail
 * from AIS-20 — with the same two guarantees:
 *
 * - an invalid or missing value falls back to the caller's default instead of
 *   throwing, so a hand-edited or stale link still renders;
 * - one user action is **one** URL write, and the existing parameters of the
 *   page are preserved rather than rebuilt.
 *
 * The parameter is removed from the URL when it equals the fallback, so the
 * canonical address of the first step carries no query string.
 */

import { useSearchParams } from 'react-router-dom';
import { parseAllowedValue } from './use-tab-param.logic.js';
import type {
  UseTabParamOptions,
  UseTabParamResult,
} from './use-tab-param.interface.js';

/**
 * Reads and writes one enum-like URL parameter.
 *
 * @param options - parameter name, the closed set of legal values and the default.
 * @returns the parsed value and a setter that performs one navigation.
 */
export function useTabParam<TValue extends string>(
  options: UseTabParamOptions<TValue>,
): UseTabParamResult<TValue> {
  const { paramName, allowed, fallback } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  const value = parseAllowedValue(searchParams.get(paramName), allowed, fallback);

  const setValue = (next: TValue): void => {
    const params = new URLSearchParams(searchParams);

    if (next === fallback) {
      params.delete(paramName);
    } else {
      params.set(paramName, next);
    }

    setSearchParams(params, { replace: false });
  };

  return { value, setValue };
}
