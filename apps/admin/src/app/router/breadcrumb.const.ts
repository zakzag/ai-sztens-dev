/**
 * Constants of the breadcrumb derivation (AIS-146).
 *
 * They live here, not in the logic file, so the matcher and its tests read the
 * same literals: a separator or a catch-all marker can never drift.
 */

/** Separator of URL path segments. */
export const BREADCRUMB_PATH_SEPARATOR = '/';

/** Prefix that marks a `:param` segment of a route template. */
export const BREADCRUMB_PARAM_PREFIX = ':';

/**
 * The catch-all route path.
 *
 * It is a page, not a position in the hierarchy, so the matcher never selects
 * it: an unknown URL therefore yields no trail at all.
 */
export const BREADCRUMB_CATCH_ALL_PATH = '*';
