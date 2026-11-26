import type { ReactElement, ReactNode } from 'react';

/**
 * One crumb of a {@link Breadcrumb} trail.
 *
 * `to` is optional on purpose: a crumb without a target renders as plain text
 * instead of a dead link (see {@link BreadcrumbProps}).
 */
export interface BreadcrumbItem {
  /** Visible crumb text. */
  readonly label: string;
  /** Target path of this crumb. Ignored on the last crumb. */
  readonly to?: string;
}

/**
 * Arguments handed to the injected link factory.
 *
 * The renderer owns the element itself, so the caller decides whether the crumb
 * becomes a router `Link`, a plain `<a>` or something else.
 */
export interface BreadcrumbLinkRendererProps {
  /** Target path of the crumb. */
  readonly to: string;
  /** Visible crumb text, already resolved to a node. */
  readonly children: ReactNode;
}

/**
 * Injected link factory of a {@link Breadcrumb}.
 *
 * `packages/ui` never imports a router, so the link element is supplied by the
 * caller: the admin passes a `react-router` `Link` adapter, the default
 * implementation falls back to a plain `<a href>`.
 */
export type BreadcrumbLinkRenderer = (
  props: BreadcrumbLinkRendererProps,
) => ReactElement;

/**
 * Props of {@link Breadcrumb}.
 */
export interface BreadcrumbProps {
  /** The trail, first item (root) to last item (current page). */
  readonly items: readonly BreadcrumbItem[];
  /** Accessible name of the `<nav>`; defaults to `BREADCRUMB_DEFAULT_ARIA_LABEL`. */
  readonly ariaLabel?: string;
  /**
   * Optional link factory. When omitted, a crumb with a `to` renders as a plain
   * `<a href>` — a full page navigation, not an SPA navigation.
   */
  readonly renderLink?: BreadcrumbLinkRenderer;
}
