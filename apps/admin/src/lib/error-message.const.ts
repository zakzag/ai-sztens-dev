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

/**
 * `STALE_WRITE` — the payload was written against a version that no longer
 * exists, so applying it would overwrite somebody else's change (AIS-108).
 *
 * Deliberately not a field error: the server blames `updatedAt`, a hidden
 * concurrency token the user cannot edit, so the only useful action is a reload.
 */
export const STALE_WRITE_MESSAGE =
  'Az adatot közben valaki más módosította. Töltsd újra az oldalt, majd próbáld újra.';

/**
 * `SEMANTIC_VALIDATION_FAILED` — the shape is valid, the content is not
 * (AIS-108), e.g. an `expiresAt` in the past. Rendered on the offending field
 * when the envelope names one, page-level otherwise.
 */
export const SEMANTIC_VALIDATION_FAILED_MESSAGE =
  'A megadott érték tartalmilag nem megfelelő. Ellenőrizd az adatokat.';

/** `UNEXPECTED_PAYLOAD` — the client could not parse a contract-conform body. */
export const UNEXPECTED_PAYLOAD_USER_MESSAGE =
  'A szerver váratlan választ adott. Próbáld újra később.';

/**
 * The `code` → copy table itself lives in
 * [`api-error-code.const.ts`](./api-error-code.const.ts:1) as
 * `ERROR_CODE_MESSAGE`, derived from `ERROR_CODE_CATALOGUE`.
 *
 * This file stays the **only** home of Hungarian literals: the catalogue only
 * wires codes to these symbols, so a new server code cannot introduce copy that
 * nobody reviewed.
 */
