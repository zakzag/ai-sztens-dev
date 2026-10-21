/**
 * User-facing texts of {@link toErrorMessage}.
 *
 * They live here instead of inside the mapping function so the exact wording is
 * reviewable (and translatable) in one place, and so the tests can assert
 * against the same symbol the UI renders.
 */

/** The request never reached the server (offline, DNS, CORS, abort). */
export const NETWORK_ERROR_USER_MESSAGE =
  'Nem sikerült elérni a szervert. Ellenőrizd az internetkapcsolatot, majd próbáld újra.';

/** 401 — the token is missing or expired. */
export const SESSION_EXPIRED_MESSAGE = 'Lejárt a munkamenet. Jelentkezz be újra.';

/** 403 — authenticated but not allowed. */
export const FORBIDDEN_MESSAGE = 'Nincs jogosultságod ehhez a művelethez.';

/** 404 — the resource is gone (or the identifier is wrong). */
export const NOT_FOUND_MESSAGE = 'A keresett elem nem található.';

/** 409 without a usable backend message. */
export const CONFLICT_MESSAGE = 'A művelet ütközik egy már létező elemmel.';

/** 400/422 without a usable backend message. */
export const VALIDATION_MESSAGE = 'A megadott adatok érvénytelenek.';

/** 5xx — the backend itself failed. */
export const SERVER_ERROR_MESSAGE = 'A szerver hibát jelzett. Próbáld újra később.';

/** Anything that is not an `ApiError`, or a status with no dedicated text. */
export const UNKNOWN_ERROR_MESSAGE = 'Váratlan hiba történt. Próbáld újra.';
