import { ApiKeysPage } from '../../pages/api-keys/ApiKeysPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { PlaceholderPage } from '../../pages/PlaceholderPage.js';
import {
  APP_NAV_HOME_LABEL,
  APP_NOT_FOUND_MESSAGE,
  APP_ROUTE_API_KEYS_PATH,
  APP_ROUTE_CALLS_PATH,
  APP_ROUTE_HOME_PATH,
  APP_ROUTE_LOGIN_PATH,
} from '../app.const.js';
import type { RouteEntry } from './route-entry.interface.js';

/**
 * The route registry — the single place where a route exists (AIS-118, `D1`).
 *
 * Both the `<Routes>` markup and the navigation are derived from these lists,
 * so a new page is one entry — never a second, hand-written list that could
 * drift. The nav shows exactly the protected entries that carry a
 * `navLabel` and are not `hidden`.
 *
 * The registry holds **data only**: the elements are already instantiated, and
 * every decision about them lives in the router and the nav.
 */

/**
 * Routes reachable without a session.
 *
 * The login page is the only one today. It renders outside the authenticated
 * layout, so it has no nav entry.
 */
export const PUBLIC_ROUTE_ENTRIES: readonly RouteEntry[] = [
  {
    path: APP_ROUTE_LOGIN_PATH,
    navLabel: null,
    element: <LoginPage />,
    protected: false,
  },
];

/**
 * Routes rendered inside the authenticated layout.
 *
 * `navLabel: null` means "reachable, but not linked" — the landing page and
 * the catch-all fallback are reachable by URL only.
 */
export const PROTECTED_ROUTE_ENTRIES: readonly RouteEntry[] = [
  {
    path: APP_ROUTE_HOME_PATH,
    navLabel: APP_NAV_HOME_LABEL,
    element: <PlaceholderPage />,
    protected: true,
    hidden: true,
  },
  {
    path: APP_ROUTE_API_KEYS_PATH,
    navLabel: 'API kulcsok',
    element: <ApiKeysPage />,
    protected: true,
  },
  {
    path: APP_ROUTE_CALLS_PATH,
    navLabel: 'Hívások',
    element: <p className="text-text-secondary">Hívások — hamarosan</p>,
    protected: true,
  },
];

/**
 * The catch-all entry: an unknown URL answers with a short message instead of
 * an empty page. It is a route like any other, so the router needs no
 * hard-coded fallback.
 */
export const NOT_FOUND_ROUTE_ENTRY: RouteEntry = {
  path: '*',
  navLabel: null,
  element: <p className="text-text-secondary">{APP_NOT_FOUND_MESSAGE}</p>,
  protected: true,
};

/** Every route of the application, public and protected alike. */
export const ALL_ROUTE_ENTRIES: readonly RouteEntry[] = [
  ...PUBLIC_ROUTE_ENTRIES,
  ...PROTECTED_ROUTE_ENTRIES,
];
