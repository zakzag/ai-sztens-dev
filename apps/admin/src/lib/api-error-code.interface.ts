/**
 * Types of the single error-code catalogue.
 *
 * The catalogue answers exactly two questions per server code, which is what the
 * whole UI needs:
 *
 * 1. **what does the user read** ({@link ApiErrorCodeCopy.message});
 * 2. **may this failure blame an input** ({@link ApiErrorCodeCopy.fieldMessage}).
 *
 * Everything else — the surface decision, the banner condition, the field path —
 * is derived from these two, so a new code cannot be half-supported.
 */

/**
 * Copy and capability of one code.
 *
 * Both members are client-owned Hungarian text: the server's `issue.message` is
 * an English developer sentence and is never rendered.
 */
export interface ApiErrorCodeCopy {
  /** Page / alert sentence; every code has one. */
  readonly message: string;
  /**
   * Field-level sentence, or `null` when the code may never claim “this input is
   * wrong”.
   *
   * Non-`null` is the allow-list the classifier and the field mapping share:
   * a code outside it stays page-level even when it carries `details[].path`.
   */
  readonly fieldMessage: string | null;
}
