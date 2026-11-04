/**
 * Limits and patterns of the common format rules (AIS-112).
 *
 * Every number here is referenced by a schema in this folder, so the browser
 * form, the API client and the server validate with **one** set of numbers
 * (plan decision `D1` of the AIS-112 plan). A literal in a schema would be a
 * second truth.
 */

/** Max length of an e-mail address (RFC 5321 practical limit). */
export const EMAIL_MAX_LENGTH = 320;

/** Max length of a URL accepted from a user. */
export const URL_MAX_LENGTH = 2048;

/**
 * Protocols a user-supplied URL may use.
 *
 * A whitelist, not a blacklist: `z.string().url()` accepts anything `new URL()`
 * parses — including `javascript:` and `data:` — and a URL that reaches an
 * `href` is an injection sink.
 */
export const ALLOWED_URL_PROTOCOLS = ['https://', 'http://'] as const;

/** Max length of a short free-text field (name, label, …). */
export const SHORT_TEXT_MAX_LENGTH = 200;

/** Max length of a long free-text field (description, note, …). */
export const LONG_TEXT_MAX_LENGTH = 2000;

/**
 * Shape of a Hungarian tax number: 8 digits, a VAT code (1 digit) and the
 * area code (2 digits), separated by dashes — `12345678-1-23`.
 */
export const HU_TAX_NUMBER_PATTERN = /^(\d{8})-(\d)-(\d{2})$/;

/** Length of a formatted Hungarian tax number (`XXXXXXXX-Y-ZZ`). */
export const HU_TAX_NUMBER_MAX_LENGTH = 11;

/**
 * Weights of the eight-digit tax number body.
 *
 * The eighth digit is a check digit derived from the first seven, so the
 * weights cover exactly those seven positions.
 */
export const HU_TAX_NUMBER_CHECK_DIGIT_WEIGHTS = [9, 7, 3, 1, 9, 7, 3] as const;

/** Lowest accepted VAT code (`-Y-` part). */
export const HU_TAX_NUMBER_VAT_CODE_MIN = 1;

/** Highest accepted VAT code (`-Y-` part). */
export const HU_TAX_NUMBER_VAT_CODE_MAX = 5;

/** Lowest accepted area code (`-ZZ` part). */
export const HU_TAX_NUMBER_AREA_CODE_MIN = 1;

/** Highest accepted area code (`-ZZ` part). */
export const HU_TAX_NUMBER_AREA_CODE_MAX = 44;

/** A Hungarian postal code is exactly four digits. */
export const HU_POSTAL_CODE_PATTERN = /^\d{4}$/;

/** Number of digits in a Hungarian postal code. */
export const HU_POSTAL_CODE_LENGTH = 4;

/** A calendar day without a timezone: `YYYY-MM-DD`. */
export const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Length of a `YYYY-MM-DD` string. */
export const DATE_ONLY_LENGTH = 10;

/** Country used when a phone number arrives without an international prefix. */
export const PHONE_DEFAULT_COUNTRY = 'HU';

/** Max length of a phone number as typed by a user (before normalisation). */
export const PHONE_INPUT_MAX_LENGTH = 32;

/** Shortest possible IBAN (Norway). */
export const IBAN_MIN_LENGTH = 15;

/** Longest possible IBAN (Malta). */
export const IBAN_MAX_LENGTH = 34;

/** IBAN shape after whitespace removal and upper-casing. */
export const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

/** The modulus of the ISO 13616 check-digit algorithm. */
export const IBAN_MODULUS = 97;

/** A valid IBAN leaves this remainder after the mod-97 step. */
export const IBAN_VALID_REMAINDER = 1;

/** Offset used to turn a letter into its numeric IBAN value (`A` → `10`). */
export const IBAN_LETTER_OFFSET = 55;
