import { ApiKeyDetailPage } from '../../pages/api-keys/ApiKeyDetailPage.js';
import {
  API_KEYS_CREATE_LABEL,
  API_KEYS_CREATE_ROUTE_PATH,
  API_KEY_DETAIL_ROUTE_PATH,
  API_KEY_VIEW_ROUTE_PATH,
} from '../../pages/api-keys/api-keys.const.js';
import { ApiKeysPage } from '../../pages/api-keys/ApiKeysPage.js';
import { ApiKeyCreateDialog } from '../../pages/api-keys/ui/ApiKeyCreateDialog.js';
import { ApiKeyViewDialog } from '../../pages/api-keys/ui/ApiKeyViewDialog.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { PlaceholderPage } from '../../pages/PlaceholderPage.js';
import {
  APP_API_KEYS_LABEL,
  APP_CALLS_LABEL,
  APP_NAV_HOME_LABEL,
  APP_NOT_FOUND_MESSAGE,
  APP_ROUTE_API_KEYS_PATH,
  APP_ROUTE_CALLS_PATH,
  APP_ROUTE_HOME_PATH,
  APP_ROUTE_LOGIN_PATH,
} from '../app.const.js';
import type { RouteEntry } from './route-entry.interface.js';
import { flattenRouteEntries } from './route-tree.logic.js';

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
    // The login page renders outside the authenticated shell, so it has no
    // trail either — see `RouteEntry.breadcrumbLabel`.
    breadcrumbLabel: null,
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
    // The root of every trail: it has a crumb but no parent.
    breadcrumbLabel: APP_NAV_HOME_LABEL,
  },
  {
    // The list is a **parent** route since AIS-155: its two overlay children
    // render into the page's `<Outlet/>`, so the list stays mounted behind the
    // dialog and the overlay has an address of its own.
    path: APP_ROUTE_API_KEYS_PATH,
    navLabel: APP_API_KEYS_LABEL,
    element: <ApiKeysPage />,
    protected: true,
    breadcrumbLabel: APP_API_KEYS_LABEL,
    breadcrumbParentPath: APP_ROUTE_HOME_PATH,
    children: [
      {
        // Reachable from the list header's action, not from a URL parameter —
        // which is why a `null` nav label is legal here (AIS-155 `D2`).
        path: API_KEYS_CREATE_ROUTE_PATH,
        navLabel: null,
        element: <ApiKeyCreateDialog />,
        protected: true,
        breadcrumbLabel: API_KEYS_CREATE_LABEL,
        breadcrumbParentPath: APP_ROUTE_API_KEYS_PATH,
      },
      {
        // Read-only overlay of one key: the segment is a parameter, so the crumb
        // text comes from a resolver, exactly like the detail route's.
        path: API_KEY_VIEW_ROUTE_PATH,
        navLabel: null,
        element: <ApiKeyViewDialog />,
        protected: true,
        breadcrumbLabel: null,
        breadcrumbParentPath: APP_ROUTE_API_KEYS_PATH,
        resolveBreadcrumbLabel: (params) => params.identifier,
      },
    ],
  },
  {
    // The detail page is reached from the list, never from the navigation, so it
    // carries no label (AIS-131). `NavLink to="/api-keys"` still marks the
    // section active on this URL, because React Router matches the prefix.
    //
    // The path template comes from the page folder: the table links to it too,
    // and a page may not import `app`, so the page owns the one literal.
    //
    // Breadcrumb: the segment is a URL parameter, so the text has to come from a
    // resolver (AIS-140 `D5`). The raw identifier is shown on purpose — a display
    // name is a separate decision (AIS-140 `D6`).
    path: API_KEY_DETAIL_ROUTE_PATH,
    navLabel: null,
    element: <ApiKeyDetailPage />,
    protected: true,
    breadcrumbLabel: null,
    breadcrumbParentPath: APP_ROUTE_API_KEYS_PATH,
    resolveBreadcrumbLabel: (params) => params.identifier,
  },
  {
    path: APP_ROUTE_CALLS_PATH,
    navLabel: APP_CALLS_LABEL,
    element: <p className="text-text-secondary">Hívások — hamarosan</p>,
    protected: true,
    breadcrumbLabel: APP_CALLS_LABEL,
    breadcrumbParentPath: APP_ROUTE_HOME_PATH,
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
  // The catch-all is a page, not a position in the hierarchy: an unknown URL has
  // no trail at all (`toBreadcrumbItems` returns `[]`).
  breadcrumbLabel: null,
};

/**
 * Every route of the application, public and protected alike, **flattened**
 * (AIS-155 `D3`).
 *
 * The lists above are a tree because a route may host overlay children
 * (`RouteEntry.children`), but the breadcrumb matcher and the registry
 * invariants need one flat table. Flattening here keeps both views derived from
 * the same literals instead of from a second hand-written list.
 */
export const ALL_ROUTE_ENTRIES: readonly RouteEntry[] = [
  ...flattenRouteEntries(PUBLIC_ROUTE_ENTRIES),
  ...flattenRouteEntries(PROTECTED_ROUTE_ENTRIES),
];
