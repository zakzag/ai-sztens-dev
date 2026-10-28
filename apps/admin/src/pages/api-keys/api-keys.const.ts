/**
 * Texts, ids and defaults of the `api-keys` page.
 *
 * Everything user-visible lives here so the components stay markup: copy can be
 * reviewed and changed without touching JSX, and a test can assert against the
 * same constant the UI renders instead of a hard-coded string.
 */

import type { ApiKeyFormFieldName } from '../../features/api-keys/api-keys.interface.js';
import type { ApiKeyFormValues } from './api-keys.interface.js';

/** Page header. */
export const API_KEYS_PAGE_TITLE = 'API kulcsok';
export const API_KEYS_PAGE_SUBTITLE =
  'A külső szolgáltatók (pl. hangasszisztens) hozzáférési kulcsai. A kulcs értéke a mentés után nem jelenik meg újra.';

/** Table section. */
export const API_KEYS_TABLE_TITLE = 'Tárolt kulcsok';
export const API_KEYS_LOADING_MESSAGE = 'API kulcsok betöltése…';
export const API_KEYS_EMPTY_MESSAGE =
  'Még nincs tárolt API kulcs. Vedd fel az elsőt a lenti űrlapon.';
/**
 * Title of the page-level error state. The retry labels are owned by
 * `lib/error-surface.const.ts`, because every page's retry button reads the same.
 */
export const API_KEYS_ERROR_TITLE = 'Az API kulcsok betöltése nem sikerült.';

/** Column headers, in render order. */
export const API_KEY_COLUMNS = {
  name: 'Név',
  identifier: 'Azonosító',
  description: 'Leírás',
  expiresAt: 'Lejárat',
} as const;

/** Form section. */
export const API_KEY_FORM_TITLE = 'Új API kulcs felvitele';
export const API_KEY_FORM_SUBMIT_LABEL = 'Kulcs mentése';
export const API_KEY_FORM_PENDING_LABEL = 'Mentés…';
export const API_KEY_FORM_SUCCESS_MESSAGE = 'Az új API kulcs elmentve.';
export const API_KEY_FORM_ERROR_TITLE = 'Az API kulcs mentése nem sikerült.';

/**
 * DOM ids of the form controls — also the `htmlFor`/`error` wiring keys.
 *
 * Typed as a complete map over {@link ApiKeyFormFieldName} so a new field cannot
 * be rendered without an id, and a renamed one breaks the build instead of the
 * accessibility wiring.
 */
export const API_KEY_FORM_FIELD_IDS: Readonly<Record<ApiKeyFormFieldName, string>> = {
  name: 'api-key-name',
  identifier: 'api-key-identifier',
  description: 'api-key-description',
  apiKey: 'api-key-value',
  expiresAt: 'api-key-expires-at',
};

/** Visible labels, one per form field. */
export const API_KEY_FORM_LABELS: Readonly<Record<ApiKeyFormFieldName, string>> = {
  name: 'Név',
  identifier: 'Azonosító',
  description: 'Leírás',
  apiKey: 'API kulcs értéke',
  expiresAt: 'Lejárat',
};

/** Helper texts under the fields. */
export const API_KEY_FORM_HINTS: Readonly<Record<ApiKeyFormFieldName, string>> = {
  name: 'Emberi olvasásra szánt név, legfeljebb 200 karakter.',
  identifier: 'Egyedi, URL-biztos azonosító: betű, szám, pont, kötőjel, aláhúzás.',
  description: 'Opcionális, legfeljebb 2000 karakter.',
  apiKey: 'A szolgáltatótól kapott token értéke.',
  expiresAt: 'Opcionális. Üresen hagyva a kulcs nem jár le.',
};

/**
 * Initial (and post-success) form values.
 *
 * Declared here rather than derived in the logic module, so the dependency runs
 * one way only: `logic → const` and never `const → logic`.
 */
export const API_KEY_FORM_DEFAULTS: ApiKeyFormValues = {
  name: '',
  identifier: '',
  description: '',
  apiKey: '',
  expiresAt: '',
};

/** Validation messages, mapped to the fields by `apiKeyFormSchema`. */
export const API_KEY_FORM_VALIDATION_MESSAGES = {
  nameRequired: 'A név megadása kötelező.',
  nameTooLong: 'A név legfeljebb 200 karakter lehet.',
  identifierRequired: 'Az azonosító megadása kötelező.',
  identifierInvalid:
    'Az azonosító csak betűt, számot, pontot, kötőjelet és aláhúzást tartalmazhat (legfeljebb 200 karakter).',
  descriptionTooLong: 'A leírás legfeljebb 2000 karakter lehet.',
  apiKeyRequired: 'Az API kulcs értékének megadása kötelező.',
  apiKeyTooLong: 'Az API kulcs értéke legfeljebb 4000 karakter lehet.',
  expiresAtInvalid: 'Érvényes dátumot adj meg (éééé-hh-nn), vagy hagyd üresen.',
} as const;
