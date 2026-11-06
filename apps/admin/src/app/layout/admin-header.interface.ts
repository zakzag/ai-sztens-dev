import type { ThemeOption } from './theme-selector.interface.js';
import type { RouteEntry } from '../router/route-entry.interface.js';

/**
 * Props of the admin header.
 *
 * The header stays props-driven: it never imports the route registry, so a test
 * can mount it with a minimal one (React coding standards §4.1).
 */
export interface AdminHeaderProps {
  /**
   * The routes the navigation and the breadcrumb are built from — the same
   * array the shell receives.
   */
  readonly routes: readonly RouteEntry[];

  /**
   * Receives the appearance the user picked.
   *
   * A port on purpose: applying a theme is out of scope here (AIS-140 `D3`), so
   * the shell passes a documented no-op and the wiring can change without
   * touching the selector.
   */
  readonly onThemeChange: (value: ThemeOption) => void;
}
