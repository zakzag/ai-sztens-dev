/**
 * The one and only validation copy catalogue (AIS-112 plan decisions `D2`/`D8`).
 *
 * `en` is the **internal** language: it is what the API puts into
 * `details[].message`, which [`docs/Specs/API-Convention.md`](../../../../docs/Specs/API-Convention.md)
 * defines as developer-facing text.
 *
 * `hu` is the **user interface** language. The admin SPA switches the locale at
 * bootstrap (`configureValidationLocale('hu')`), so the very same schema
 * produces Hungarian copy in the browser and English copy on the server.
 *
 * No component may hold a validation sentence of its own any more: a schema
 * references a key from here, and these two literals are the only copy.
 */

import type {
  ValidationLocale,
  ValidationMessageCatalogue,
} from './validation-message.interface.js';

/** Complete copy for every locale; a missing key does not compile. */
export const VALIDATION_MESSAGE_CATALOGUE: Readonly<
  Record<ValidationLocale, ValidationMessageCatalogue>
> = Object.freeze({
  en: Object.freeze({
    REQUIRED: 'This field is required.',
    INVALID_TYPE: 'Invalid value.',
    INVALID_FORMAT: 'Invalid format.',
    EMAIL: 'Enter a valid e-mail address.',
    URL: 'Enter a valid URL (e.g. https://example.com).',
    PHONE: 'Enter a valid phone number in international format (e.g. +36 30 123 4567).',
    TAX_NUMBER: 'Enter a valid Hungarian tax number (format: 12345678-1-23).',
    TAX_NUMBER_CHECKSUM:
      'The check digit of the Hungarian tax number is not valid.',
    IBAN: 'Enter a valid IBAN.',
    IBAN_CHECKSUM: 'The check digits of the IBAN are not valid.',
    POSTAL_CODE: 'Enter a valid Hungarian postal code (4 digits).',
    DATE_ONLY: 'Enter a valid date (format: YYYY-MM-DD).',
    IDENTIFIER:
      'The identifier may contain letters, digits, dot, dash and underscore only.',
    TOO_SHORT_TEMPLATE: 'At least {min} characters are required.',
    TOO_LONG_TEMPLATE: 'At most {max} characters are allowed.',
  }),
  hu: Object.freeze({
    REQUIRED: 'Kötelező mező.',
    INVALID_TYPE: 'Érvénytelen érték.',
    INVALID_FORMAT: 'Érvénytelen formátum.',
    EMAIL: 'Érvényes e-mail-címet adj meg.',
    URL: 'Érvényes webcímet adj meg (pl. https://pelda.hu).',
    PHONE:
      'Érvényes telefonszámot adj meg nemzetközi formátumban (pl. +36 30 123 4567).',
    TAX_NUMBER: 'Érvényes adószámot adj meg (formátum: 12345678-1-23).',
    TAX_NUMBER_CHECKSUM: 'Az adószám ellenőrző számjegye nem megfelelő.',
    IBAN: 'Érvényes IBAN-t adj meg.',
    IBAN_CHECKSUM: 'Az IBAN ellenőrző számjegyei nem megfelelőek.',
    POSTAL_CODE: 'Érvényes irányítószámot adj meg (4 számjegy).',
    DATE_ONLY: 'Érvényes dátumot adj meg (formátum: éééé-hh-nn).',
    IDENTIFIER:
      'Az azonosító csak betűt, számot, pontot, kötőjelet és aláhúzást tartalmazhat.',
    TOO_SHORT_TEMPLATE: 'Legalább {min} karakter szükséges.',
    TOO_LONG_TEMPLATE: 'Legfeljebb {max} karakter lehet.',
  }),
});
