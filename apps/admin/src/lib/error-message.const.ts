/**
 * User-facing texts of {@link toErrorMessage}.
 *
 * They live here instead of inside the mapping function so the exact wording is
 * reviewable (and translatable) in one place, and so the tests can assert
 * against the same symbol the UI renders.
 *
 * `ERROR_CODE_MESSAGE` is the **primary** table (plan `D3`): the server sends a
 * stable machine `code`, and this is where a code becomes Hungarian copy. A code
 * that is missing here falls back to the status-based text below, so a newer
 * server never breaks a deployed bundle.
 */

/** The request never reached the server (offline, DNS, CORS, abort). */
export const NETWORK_ERROR_USER_MESSAGE =
  'Nem sikerült elérni a szervert. Ellenőrizd az internetkapcsolatot, majd próbáld újra.';

/** 401 — the token is missing or expired. */
export const SESSION_EXPIRED_MESSAGE =
  'Lejárt a munkamenet. Jelentkezz be újra.';

/** 403 — authenticated but not allowed. */
export const FORBIDDEN_MESSAGE = 'Nincs jogosultságod ehhez a művelethez.';

/** 404 — the resource is gone (or the identifier is wrong). */
export const NOT_FOUND_MESSAGE = 'A keresett elem nem található.';

/** 409 without a more specific code. */
export const CONFLICT_MESSAGE = 'A művelet ütközik egy már létező elemmel.';

/** 400/422 without a more specific code. */
export const VALIDATION_MESSAGE = 'A megadott adatok érvénytelenek.';

/** 5xx — the backend itself failed. */
export const SERVER_ERROR_MESSAGE =
  'A szerver hibát jelzett. Próbáld újra később.';

/** Anything that is not an `ApiError`, or a status with no dedicated text. */
export const UNKNOWN_ERROR_MESSAGE = 'Váratlan hiba történt. Próbáld újra.';

/** `API_KEY_IDENTIFIER_CONFLICT` — the unique lookup key is taken. */
export const IDENTIFIER_CONFLICT_MESSAGE =
  'Ez az azonosító már létezik. Válassz másikat.';

/**
 * Field-level copy of a duplicate identifier (plan `D11`, tier 1).
 *
 * Shorter and more actionable than {@link IDENTIFIER_CONFLICT_MESSAGE}, because
 * it is rendered under the input the user has to change. The text is owned by
 * the client: the server's `issue.message` is English and never rendered.
 */
export const API_KEY_IDENTIFIER_FIELD_MESSAGE =
  'Ez az identifier már foglalt. Adj meg egyedit.';

/**
 * `VALIDATION_FAILED` on an identified field (plan `D11`, tier 1).
 *
 * Deliberately generic: the server's per-issue text (`issue.message`) is a
 * developer sentence, and a field that the client already validated is one the
 * server refused for a rule the client does not know — the user only needs to
 * know *which* input is wrong and that it must be corrected.
 */
export const FIELD_INVALID_MESSAGE = 'Érvénytelen érték. Javítsd a mezőt.';

/** `PAYLOAD_TOO_LARGE` — the body exceeded the configured limit. */
export const PAYLOAD_TOO_LARGE_MESSAGE =
  'A beküldött adat túl nagy. Rövidítsd le, majd próbáld újra.';

/** `RATE_LIMITED` — too many requests in the window. */
export const RATE_LIMITED_MESSAGE =
  'Túl sok kérés érkezett. Várj egy kicsit, majd próbáld újra.';

/** `SERVICE_UNAVAILABLE` — a dependency is down; retryable. */
export const SERVICE_UNAVAILABLE_MESSAGE =
  'A szolgáltatás átmenetileg nem elérhető. Próbáld újra később.';

/** `UNEXPECTED_PAYLOAD` — the client could not parse a contract-conform body. */
export const UNEXPECTED_PAYLOAD_USER_MESSAGE =
  'A szerver váratlan választ adott. Próbáld újra később.';

/**
 * `code` → Hungarian user copy.
 *
 * The keys are the values of `API_ERROR_CODE` from `@callback/shared` plus the
 * client-side `UNEXPECTED_PAYLOAD`; the type stays `string` on purpose, because
 * a code from a newer server must degrade to the status fallback instead of
 * failing to compile.
 */
export const ERROR_CODE_MESSAGE: Readonly<Record<string, string>> = {
  VALIDATION_FAILED: VALIDATION_MESSAGE,
  UNAUTHENTICATED: SESSION_EXPIRED_MESSAGE,
  FORBIDDEN: FORBIDDEN_MESSAGE,
  NOT_FOUND: NOT_FOUND_MESSAGE,
  CONFLICT: CONFLICT_MESSAGE,
  PAYLOAD_TOO_LARGE: PAYLOAD_TOO_LARGE_MESSAGE,
  RATE_LIMITED: RATE_LIMITED_MESSAGE,
  INTERNAL_ERROR: SERVER_ERROR_MESSAGE,
  SERVICE_UNAVAILABLE: SERVICE_UNAVAILABLE_MESSAGE,
  API_KEY_IDENTIFIER_CONFLICT: IDENTIFIER_CONFLICT_MESSAGE,
  UNEXPECTED_PAYLOAD: UNEXPECTED_PAYLOAD_USER_MESSAGE,
};
