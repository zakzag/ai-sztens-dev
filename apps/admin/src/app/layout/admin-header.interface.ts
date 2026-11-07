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
   * The appearance currently applied (AIS-167).
   *
   * The header itself never reads the theme context: it stays props-driven, so a
   * test can mount it without a provider and the shell remains the only place
   * that knows about the engine.
   */
  readonly theme: ThemeOption;

  /**
   * Receives the appearance the user picked, forwarded unchanged.
   *
   * A port on purpose: the header does not apply anything, so the shell decides
   * what "changing the appearance" means (today: the theme provider).
   */
  readonly onThemeChange: (value: ThemeOption) => void;
}
