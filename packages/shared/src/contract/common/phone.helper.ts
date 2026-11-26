/**
 * Phone normalisation (AIS-112 plan decision `D3`).
 *
 * `libphonenumber-js` is used instead of a hand-written regex: a regex can
 * check *shape*, but only a numbering-plan database can tell whether
 * `+36 30 123 4567` is a live Hungarian mobile and which digits belong to the
 * country, the area code and the subscriber. Hand-rolling that is a classic
 * source of silently wrong numbers.
 *
 * The normalised form is **E.164** (`+36301234567`), which is what the database
 * stores and what a dialler accepts (ticket `D4`).
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { PHONE_DEFAULT_COUNTRY } from './format.const.js';

/**
 * @param value - a phone number as typed by a user (spaces, dashes, brackets).
 * @returns the E.164 form, or `null` when the number is not valid for its
 *   country.
 */
export function normalizePhone(value: string): string | null {
  const parsed = parsePhoneNumberFromString(value.trim(), PHONE_DEFAULT_COUNTRY);

  return parsed !== undefined && parsed.isValid() ? parsed.number : null;
}

/**
 * @param value - a phone number as typed by a user.
 * @returns `true` when it is a dialable number.
 */
export function isValidPhone(value: string): boolean {
  return normalizePhone(value) !== null;
}
