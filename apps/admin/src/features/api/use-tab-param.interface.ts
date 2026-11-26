/**
 * Types of the URL-owned tab/step reader (AIS-19).
 *
 * `tab` and `step` are **not** list-query fields: `useListParams` parses the
 * paging/filter/sort contract of a resource, while these two parameters select a
 * view inside one route. They get their own reader rather than a second branch
 * in `useListParams`, so the list contract stays free of view state.
 */

/** Inputs of {@link useTabParam}. */
export interface UseTabParamOptions<TValue extends string> {
  /** URL parameter name, e.g. `step` or `tab`. */
  readonly paramName: string;
  /** The closed set of legal values, in display order. */
  readonly allowed: readonly TValue[];
  /** Value used when the parameter is missing or invalid. */
  readonly fallback: TValue;
  /**
   * Query keys removed **in the same write** as the tab change (AIS-181).
   *
   * A view switch invalidates the previous view's list state: the customer
   * detail's two paged tabs share `page`/`limit`, so `?tab=activity&page=3` must
   * not turn into `?tab=audit&page=3` (an out-of-range page of a different
   * collection). Deleting them here — and not with a second `setSearchParams` —
   * is what keeps one interaction to one history entry.
   */
  readonly clearParams?: readonly string[];
}

/** What {@link useTabParam} returns. */
export interface UseTabParamResult<TValue extends string> {
  /** The parsed value; always one of `allowed`. */
  readonly value: TValue;
  /** Writes the value back to the URL, in **one** navigation. */
  readonly setValue: (value: TValue) => void;
}

/**
 * Inputs of `applyTabWrite`.
 *
 * The `allowed` set is deliberately absent: the narrowing already happened when
 * the value was parsed, so the writer only has to serialise one legal value.
 */
export interface TabWriteOptions {
  /** URL parameter name, e.g. `tab`. */
  readonly paramName: string;
  /** The value to write. */
  readonly value: string;
  /** The value that is expressed by the parameter's **absence**. */
  readonly fallback: string;
  /** Query keys removed in the same write. */
  readonly clearParams?: readonly string[];
}
