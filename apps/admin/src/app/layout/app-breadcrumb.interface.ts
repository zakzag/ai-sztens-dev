import type { RouteEntry } from '../router/route-entry.interface.js';

/**
 * Props of {@link AppBreadcrumb}.
 */
export interface AppBreadcrumbProps {
  /**
   * The route registry the trail is derived from. Injected rather than
   * imported, exactly like {@link AdminLayoutProps.routes}: the shell and the
   * breadcrumb stay testable with a minimal registry, and neither owns a hidden
   * copy of the application's route table.
   */
  readonly routes: readonly RouteEntry[];
}
