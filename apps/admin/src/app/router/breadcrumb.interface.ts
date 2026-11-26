import type { BreadcrumbItem } from '@callback/ui';
import type { RouteEntry } from './route-entry.interface.js';

/**
 * One cell of the admin's breadcrumb trail.
 *
 * Aliased to the primitive's own item type on purpose: a copy would be free to
 * drift from the props {@link BreadcrumbCrumb}s are handed to (AIS-146 `D3`).
 */
export type BreadcrumbCrumb = BreadcrumbItem;

/**
 * Result of matching a URL against the route registry.
 *
 * The params are collected by the matcher itself, so the caller needs no
 * router hook: the trail builder is pure and works from a pathname alone
 * (AIS-146 `D4`).
 */
export interface MatchedRoute {
  /** The entry whose `path` matched. */
  readonly entry: RouteEntry;

  /** Values captured from the `:param` segments of `entry.path`. */
  readonly params: Readonly<Record<string, string>>;
}
