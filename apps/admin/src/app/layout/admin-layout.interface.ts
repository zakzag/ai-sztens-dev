import type { ReactNode } from 'react';
import type { RouteEntry } from '../router/route-entry.interface.js';

/** Props of {@link AdminLayout}. */
export interface AdminLayoutProps {
  /**
   * The routes to link in the navigation. Injected rather than imported so
   * the component can be tested with a minimal registry, and so the shell has
   * no hidden dependency on the application's route table.
   */
  readonly routes: readonly RouteEntry[];

  /** The routed page content. */
  readonly children: ReactNode;
}
