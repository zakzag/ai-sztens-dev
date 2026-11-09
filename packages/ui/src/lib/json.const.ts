/**
 * Indentation of the pretty-printed JSON shown in the log drawer (AIS-163).
 *
 * Two spaces is the width every JSON consumer in the ecosystem expects and it
 * keeps a nested query key readable inside the narrow detail region — four
 * spaces would push deep structures off the panel.
 *
 * Declared in `lib/` (not next to the log-drawer constants) on purpose: the
 * formatter is a pure `lib` helper, and `lib` must never import from
 * `components`.
 */
export const JSON_PRETTY_INDENT = 2;

/**
 * The empty value of the "which fields are expanded" state.
 *
 * A shared, never-mutated value, so the initial `useState` and every reset do
 * not allocate a new set on each render. Callers always build a **new** set
 * before changing anything, so sharing this one is safe.
 */
export const NO_EXPANDED_JSON: ReadonlySet<string> = new Set<string>();
