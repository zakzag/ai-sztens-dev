import { NavLink } from 'react-router-dom';
import { APP_NAV_LABEL } from '../app.const.js';
import type { AdminNavProps } from './admin-nav.interface.js';

/**
 * The navigation of the admin shell, generated from the route registry.
 *
 * There is no hand-written link list: a route appears here exactly when it
 * carries a `navLabel` and is not `hidden` (AIS-118, `D1`). Adding a page is
 * therefore a single registry entry — the link shows up on its own.
 *
 * The active entry is marked by `NavLink`, which sets `aria-current="page"`.
 * That is both the visual highlight and the accessible state, so the two
 * cannot disagree.
 *
 * @param props - see {@link AdminNavProps}.
 * @returns the navigation landmark with one link per visible route.
 */
export function AdminNav({ routes }: AdminNavProps) {
  const visibleRoutes = routes.filter(
    (route) => route.navLabel !== null && route.hidden !== true,
  );

  return (
    <nav aria-label={APP_NAV_LABEL}>
      <ul className="flex items-center gap-4">
        {visibleRoutes.map((route) => (
          <li key={route.path}>
            <NavLink
              className={({ isActive }) =>
                `transition-colors duration-fast ${
                  isActive
                    ? 'font-medium text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`
              }
              to={route.path}
            >
              {route.navLabel}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
