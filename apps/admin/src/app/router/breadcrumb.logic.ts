import {
  BREADCRUMB_CATCH_ALL_PATH,
  BREADCRUMB_PARAM_PREFIX,
  BREADCRUMB_PATH_SEPARATOR,
} from './breadcrumb.const.js';
import type { BreadcrumbCrumb, MatchedRoute } from './breadcrumb.interface.js';
import type { RouteEntry } from './route-entry.interface.js';

/**
 * Pure derivation of the admin breadcrumb trail from the route registry
 * (AIS-146, decision `D5` of AIS-140).
 *
 * Nothing in this file touches React, the DOM or the network: it takes the
 * registry and a pathname, and returns the crumbs. That is what lets the trail
 * be tested branch by branch and what keeps the component a one-liner.
 */

/**
 * Strips a trailing slash so `/api-keys/` and `/api-keys` match the same entry.
 *
 * `'/'` itself stays untouched — it is a path, not an empty one.
 *
 * @param pathname - the pathname to normalise.
 * @returns the pathname without a trailing separator.
 */
function normalisePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith(BREADCRUMB_PATH_SEPARATOR)) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

/**
 * @param path - a route template or a pathname.
 * @returns its non-empty segments, left to right.
 */
function segmentsOf(path: string): readonly string[] {
  return path
    .split(BREADCRUMB_PATH_SEPARATOR)
    .filter((segment) => segment.length > 0);
}

/**
 * @param path - a route template.
 * @returns `true` when the template contains at least one `:param` segment.
 */
function isDynamicPath(path: string): boolean {
  return path.includes(BREADCRUMB_PARAM_PREFIX);
}

/**
 * @param entry - a registry entry.
 * @returns `true` when the URL matcher may select this entry.
 */
function isMatchable(entry: RouteEntry): boolean {
  // The catch-all answers an unknown URL; it has no position in the
  // hierarchy, so a trail must never be built from it.
  return entry.path !== BREADCRUMB_CATCH_ALL_PATH;
}

/**
 * Decodes one captured segment the way React Router decodes its params.
 *
 * A malformed escape (`%`) would throw, and losing a whole trail over it is
 * worse than showing the raw text, so the segment is returned verbatim.
 *
 * @param segment - the raw URL segment.
 * @returns the decoded segment, or the raw one when it cannot be decoded.
 */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Captures the `:param` values of a dynamic template.
 *
 * @param templateSegments - segments of the route template.
 * @param pathnameSegments - segments of the pathname, same length.
 * @returns the captured params, or `null` when a literal segment differs.
 */
function collectParams(
  templateSegments: readonly string[],
  pathnameSegments: readonly string[],
): Readonly<Record<string, string>> | null {
  const params: Record<string, string> = {};

  for (const [index, templateSegment] of templateSegments.entries()) {
    const actualSegment = pathnameSegments[index];

    if (actualSegment === undefined || actualSegment.length === 0) {
      return null;
    }

    if (templateSegment.startsWith(BREADCRUMB_PARAM_PREFIX)) {
      params[templateSegment.slice(BREADCRUMB_PARAM_PREFIX.length)] =
        decodeSegment(actualSegment);
      continue;
    }

    if (templateSegment !== actualSegment) {
      return null;
    }
  }

  return params;
}

/**
 * First matching pass: an entry whose path is fully static.
 *
 * @param routes - the registry to search.
 * @param pathname - the normalised pathname.
 * @returns the matching entry, or `null`.
 */
function matchStaticEntry(
  routes: readonly RouteEntry[],
  pathname: string,
): RouteEntry | null {
  return (
    routes.find(
      (entry) =>
        isMatchable(entry) &&
        !isDynamicPath(entry.path) &&
        normalisePathname(entry.path) === pathname,
    ) ?? null
  );
}

/**
 * Second matching pass: an entry with `:param` segments.
 *
 * It runs only when no static entry matched, so a literal path can never be
 * shadowed by a parameter that happens to look the same.
 *
 * @param routes - the registry to search.
 * @param pathname - the normalised pathname.
 * @returns the matching entry and its params, or `null`.
 */
function matchDynamicEntry(
  routes: readonly RouteEntry[],
  pathname: string,
): MatchedRoute | null {
  const pathnameSegments = segmentsOf(pathname);

  for (const entry of routes) {
    if (!isMatchable(entry) || !isDynamicPath(entry.path)) {
      continue;
    }

    const templateSegments = segmentsOf(entry.path);

    if (templateSegments.length !== pathnameSegments.length) {
      continue;
    }

    const params = collectParams(templateSegments, pathnameSegments);

    if (params !== null) {
      return { entry, params };
    }
  }

  return null;
}

/**
 * Selects the registry entry that owns a pathname.
 *
 * Static paths win over `:param` templates, and the catch-all never matches —
 * an unknown URL therefore has no trail at all.
 *
 * @param routes - the registry to search.
 * @param pathname - the pathname to match (`useLocation().pathname`).
 * @returns the matched entry with its params, or `null` for an unknown URL.
 */
export function matchRoute(
  routes: readonly RouteEntry[],
  pathname: string,
): MatchedRoute | null {
  const normalised = normalisePathname(pathname);
  const staticEntry = matchStaticEntry(routes, normalised);

  if (staticEntry !== null) {
    return { entry: staticEntry, params: {} };
  }

  return matchDynamicEntry(routes, normalised);
}

/**
 * Fills the `:param` segments of a route template.
 *
 * @param template - a route template such as `/api-keys/:identifier`.
 * @param params - the params captured for the current URL.
 * @returns the concrete path, or `undefined` when a param is missing — the
 * caller then renders the crumb as text instead of a dead link.
 */
export function interpolatePath(
  template: string,
  params: Readonly<Record<string, string>>,
): string | undefined {
  const resolvedSegments = segmentsOf(template).map((segment) => {
    if (!segment.startsWith(BREADCRUMB_PARAM_PREFIX)) {
      return segment;
    }

    return params[segment.slice(BREADCRUMB_PARAM_PREFIX.length)];
  });

  if (resolvedSegments.some((segment) => segment === undefined)) {
    return undefined;
  }

  return `${BREADCRUMB_PATH_SEPARATOR}${resolvedSegments.join(BREADCRUMB_PATH_SEPARATOR)}`;
}

/**
 * @param entry - a registry entry.
 * @returns `true` when the entry contributes a crumb of its own.
 */
function isInTrail(entry: RouteEntry): boolean {
  return entry.breadcrumbLabel !== null || entry.resolveBreadcrumbLabel !== undefined;
}

/**
 * @param routes - the registry.
 * @param entry - the entry whose parent is wanted.
 * @returns the parent entry, or `undefined` when the chain ends here.
 */
function parentOf(
  routes: readonly RouteEntry[],
  entry: RouteEntry,
): RouteEntry | undefined {
  if (entry.breadcrumbParentPath === undefined) {
    return undefined;
  }

  return routes.find((candidate) => candidate.path === entry.breadcrumbParentPath);
}

/**
 * Walks `breadcrumbParentPath` upwards and returns the included entries,
 * root first.
 *
 * The walk is cycle-safe: a repeated path stops it, so a mis-declared registry
 * produces a short trail instead of an endless loop. A missing parent simply
 * ends the chain — the registry test makes both cases unreachable, the runtime
 * does not throw over them.
 *
 * @param routes - the registry.
 * @param leaf - the matched entry.
 * @returns the entries that contribute a crumb, root first.
 */
function collectTrail(
  routes: readonly RouteEntry[],
  leaf: RouteEntry,
): readonly RouteEntry[] {
  const trail: RouteEntry[] = [];
  const visited = new Set<string>();
  let current: RouteEntry | undefined = leaf;

  while (current !== undefined && !visited.has(current.path)) {
    visited.add(current.path);

    if (isInTrail(current)) {
      trail.push(current);
    }

    current = parentOf(routes, current);
  }

  return trail.slice().reverse();
}

/**
 * @param entry - a registry entry in the trail.
 * @param params - the params captured for the current URL.
 * @returns the crumb text; a resolver always wins over the static label.
 */
function resolveLabel(
  entry: RouteEntry,
  params: Readonly<Record<string, string>>,
): string {
  if (entry.resolveBreadcrumbLabel !== undefined) {
    return entry.resolveBreadcrumbLabel(params);
  }

  return entry.breadcrumbLabel ?? entry.path;
}

/**
 * @param entry - a registry entry in the trail.
 * @param isLeaf - `true` for the current page (the last crumb).
 * @param params - the params captured for the current URL.
 * @returns the crumb, with a `to` on every entry but the leaf.
 */
function toCrumb(
  entry: RouteEntry,
  isLeaf: boolean,
  params: Readonly<Record<string, string>>,
): BreadcrumbCrumb {
  const label = resolveLabel(entry, params);

  if (isLeaf) {
    return { label };
  }

  const to = interpolatePath(entry.path, params);

  return to === undefined ? { label } : { label, to };
}

/**
 * Builds the breadcrumb trail of a pathname from the route registry.
 *
 * Contracts:
 * - root first, the matched entry last, and only the last crumb has no `to`;
 * - an entry with neither a static label nor a resolver is skipped, but its
 *   parent chain still builds;
 * - a missing parent ends the chain silently, a cycle stops the walk;
 * - an unknown pathname yields `[]`, so no empty navigation landmark is
 *   rendered.
 *
 * @param routes - the registry (`PROTECTED_ROUTE_ENTRIES` in the admin shell).
 * @param pathname - the current pathname (`useLocation().pathname`).
 * @returns the crumbs, root first; empty when the URL has no trail.
 */
export function toBreadcrumbItems(
  routes: readonly RouteEntry[],
  pathname: string,
): readonly BreadcrumbCrumb[] {
  const matched = matchRoute(routes, pathname);

  if (matched === null) {
    return [];
  }

  const trail = collectTrail(routes, matched.entry);

  return trail.map((entry, index) =>
    toCrumb(entry, index === trail.length - 1, matched.params),
  );
}
