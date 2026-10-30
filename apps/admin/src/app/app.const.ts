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

/** Title of the catch-all route (unknown URL). */
export const APP_NOT_FOUND_MESSAGE = 'Nem található';

/** Title of the error boundary. */
export const APP_ERROR_BOUNDARY_TITLE = 'Az oldal betöltése nem sikerült';

/** Message of the error boundary. */
export const APP_ERROR_BOUNDARY_MESSAGE =
  'Valaki hiba miatt nem tudta befejezni a rajzolást. Kérjük, töltse újra az oldalt.';

/** Label of the error boundary's reload button. */
export const APP_ERROR_BOUNDARY_RELOAD_LABEL = 'Oldal újratöltése';

/** Label of the navigation entry pointing to the landing page. */
export const APP_NAV_HOME_LABEL = 'Kezdőlap';

/** Path of the landing page. */
export const APP_ROUTE_HOME_PATH = '/';

/** Path of the login page. */
export const APP_ROUTE_LOGIN_PATH = '/login';

/** Path of the API-key manager. */
export const APP_ROUTE_API_KEYS_PATH = '/api-keys';

/** Path of the (placeholder) calls page. */
export const APP_ROUTE_CALLS_PATH = '/calls';

/**
 * Prefix reserved by the API. A SPA route must never start with it: the Vite
 * dev proxy forwards `^/api/` to the NestJS API, so a colliding route would
 * answer with JSON instead of the app shell (see `docs/Specs/UI-Architecture.md`
 * §8.1 and the `vite.config.ts` comment).
 */
export const APP_API_PATH_PREFIX = '/api/';
