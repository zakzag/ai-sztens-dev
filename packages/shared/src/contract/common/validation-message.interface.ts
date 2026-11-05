/**
 * Types of the bilingual validation copy (AIS-112 plan decisions `D2` / `D8`).
 *
 * The rule is: **the user interface speaks Hungarian, the server stays
 * English.** Both languages live in one catalogue, and a schema references a
 * *key*, never a literal — so a missing translation is a compile error and the
 * two languages can never drift apart.
 */

/** Languages the validation copy is available in. */
export type ValidationLocale = 'en' | 'hu';

/**
 * Every message key of the validation catalogue.
 *
 * The list is closed on purpose: a schema that needs new copy must extend this
 * union, and the compiler then asks for both translations.
 */
export type ValidationMessageKey =
  | 'REQUIRED'
  | 'INVALID_TYPE'
  | 'INVALID_FORMAT'
  | 'EMAIL'
  | 'URL'
  | 'PHONE'
  | 'TAX_NUMBER'
  | 'TAX_NUMBER_CHECKSUM'
  | 'IBAN'
  | 'IBAN_CHECKSUM'
  | 'POSTAL_CODE'
  | 'DATE_ONLY'
  | 'IDENTIFIER'
  | 'TOO_SHORT_TEMPLATE'
  | 'TOO_LONG_TEMPLATE';

/** One language's copy, complete for every key. */
export type ValidationMessageCatalogue = Readonly<
  Record<ValidationMessageKey, string>
>;

/** Values substituted into a message template (`{min}` / `{max}`). */
export interface ValidationMessageParams {
  /** Lower bound of a length/range rule. */
  readonly min?: number;
  /** Upper bound of a length/range rule. */
  readonly max?: number;
}
