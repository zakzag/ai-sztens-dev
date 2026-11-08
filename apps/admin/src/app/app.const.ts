/**
 * Labels and headings of the application shell.
 *
 * Constants live here (not inline in the components) so the wording has exactly
 * one home and the registry, the nav and the layout cannot drift apart.
 */

/** Product name shown in the header. */
export const APP_BRAND_LABEL = 'AIsztens — Admin';

/** Accessible name of the navigation landmark. */
export const APP_NAV_LABEL = 'Admin navigáció';

/** Title of the error boundary. */
export const APP_ERROR_BOUNDARY_TITLE = 'Az oldal betöltése nem sikerült';

/** Message of the error boundary. */
export const APP_ERROR_BOUNDARY_MESSAGE =
  'Valaki hiba miatt nem tudta befejezni a rajzolást. Kérjük, töltse újra az oldalt.';

/** Label of the error boundary's reload button. */
export const APP_ERROR_BOUNDARY_RELOAD_LABEL = 'Oldal újratöltése';

/**
 * Label of the landing page.
 *
 * Shared by the navigation entry and the breadcrumb root (AIS-146): the same
 * route must read the same way in both places, so the wording lives here once.
 */
export const APP_NAV_HOME_LABEL = 'Kezdőlap';

/** Label of the API-key manager, used by the nav and the breadcrumb (AIS-146). */
export const APP_API_KEYS_LABEL = 'API kulcsok';

/** Label of the (placeholder) calls page, used by the nav and the breadcrumb (AIS-146). */
export const APP_CALLS_LABEL = 'Hívások';

/** Path of the landing page. */
export const APP_ROUTE_HOME_PATH = '/';

/** Path of the login page. */
export const APP_ROUTE_LOGIN_PATH = '/login';

/** Path of the API-key manager. */
export const APP_ROUTE_API_KEYS_PATH = '/api-keys';

/*
 * The **detail** route template (`/api-keys/:identifier`) is deliberately *not*
 * declared here (AIS-131): the table links to it and the route registry mounts
 * it, and `pages` must not import `app` (`no-page-to-higher-layer`). It
 * therefore lives in `pages/api-keys/api-keys.const.ts`, and the registry — which
 * may import a page — takes the template from there. One literal, two consumers.
 */

/** Path of the (placeholder) calls page. */
export const APP_ROUTE_CALLS_PATH = '/calls';

/**
 * Prefix reserved by the API. A SPA route must never start with it: the Vite
 * dev proxy forwards `^/api/` to the NestJS API, so a colliding route would
 * answer with JSON instead of the app shell (see `docs/Specs/UI-Architecture.md`
 * §8.1 and the `vite.config.ts` comment).
 */
export const APP_API_PATH_PREFIX = '/api/';
