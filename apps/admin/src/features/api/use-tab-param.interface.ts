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
}

/** What {@link useTabParam} returns. */
export interface UseTabParamResult<TValue extends string> {
  /** The parsed value; always one of `allowed`. */
  readonly value: TValue;
  /** Writes the value back to the URL, in **one** navigation. */
  readonly setValue: (value: TValue) => void;
}
