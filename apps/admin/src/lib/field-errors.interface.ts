/**
 * Types of the generic failure → form mapping.
 *
 * The two members are the same pair the old feature-local mapper returned, only
 * parameterised by the form's field union, so a page cannot silently blame a
 * field it does not render.
 */

/**
 * Result of mapping one failure onto a form.
 *
 * `fields` holds one message per identified input, `form` the single message the
 * page `Alert` renders. They are exclusive per failure part: an issue that maps
 * produces no page copy.
 */
export interface FieldErrorMapping<F extends string> {
  /** Field-level messages, keyed by react-hook-form field name. */
  readonly fields: Readonly<Partial<Record<F, string>>>;
  /** Page-level message, or `null` when every issue landed on a field. */
  readonly form: string | null;
}

/**
 * What a form tells the mapper about itself.
 *
 * Passing a target object (instead of positional arguments) keeps the function
 * extensible without a fourth parameter, and keeps the domain knowledge where it
 * belongs: the `defaultPathByCode` map is owned by the feature, because only the
 * feature knows that a duplicate `identifier` belongs on its `identifier` input.
 */
export interface FieldErrorTarget<F extends string> {
  /** Every path this form owns, in visual order. */
  readonly fieldPaths: readonly F[];
  /**
   * Code → the path to blame when the envelope carried no `issues[]`.
   *
   * Entries pointing at a path outside {@link fieldPaths} are ignored, so a
   * stale entry degrades to page-level copy instead of inventing a field.
   */
  readonly defaultPathByCode?: Readonly<Record<string, F>>;
}
