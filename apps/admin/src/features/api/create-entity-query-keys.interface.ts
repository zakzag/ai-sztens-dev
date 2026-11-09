/**
 * Types of {@link createEntityQueryKeys} (AIS-175).
 *
 * The shape encodes the one property the factory exists to guarantee: `list` and
 * `detail` are **derived** from the same namespace as `all`, so invalidating
 * `all` always matches them. TanStack Query matches by prefix, which means a
 * retyped namespace literal could silently stop matching — the type system
 * cannot prevent that, but a single source string can.
 */

/**
 * Cache keys of one entity, built once per use case.
 *
 * Every key is a readonly tuple, i.e. a valid TanStack `QueryKey`, and every
 * key but `all` starts with `all`'s single element (the namespace).
 *
 * @typeParam TListParams - the validated list query (page, limit, sort, …).
 */
export interface EntityQueryKeys<TListParams extends object> {
  /**
   * Prefix shared by every query of the entity.
   *
   * Use it for invalidation: `invalidateQueries({ queryKey: keys.all })`
   * refreshes the list and every detail read without knowing their shape.
   */
  readonly all: readonly [string];

  /**
   * One key per distinct list query.
   *
   * A factory, not a constant: the response depends on the query, so a key that
   * ignored the params would serve page 1 for page 2.
   */
  readonly list: (params: TListParams) => readonly [string, 'list', TListParams];

  /** One key per addressed resource. */
  readonly detail: (identifier: string) => readonly [string, 'detail', string];
}
