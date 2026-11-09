/**
 * IBAN normalisation and the ISO 13616 check-digit algorithm (AIS-112 `D4`).
 *
 * Own implementation instead of an `iban` package: the algorithm is ~15 lines
 * of arithmetic, it has no timezone or locale dependency, and a dependency here
 * would be a supply-chain risk for a rule that never changes.
 *
 * The mod-97 is computed **digit by digit** (`remainder * 10 + digit`), so no
 * `BigInt` and no floating point is involved — a 34-character IBAN becomes a
 * ~70-digit number, which `Number` cannot hold.
 */

import {
  IBAN_LETTER_OFFSET,
  IBAN_MODULUS,
  IBAN_PATTERN,
  IBAN_VALID_REMAINDER,
} from './format.const.js';

/**
 * @param value - an IBAN as typed (groups of four, spaces, lower case).
 * @returns the canonical form: no whitespace, upper case.
 */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/**
 * Moves the country code and check digits to the end and turns every letter
 * into its two-digit value (`A` → `10`, `Z` → `35`).
 *
 * @param iban - an IBAN in canonical form.
 * @returns the numeric string the mod-97 runs on.
 */
export function toIbanNumeric(iban: string): string {
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;

  return rearranged.replace(/[A-Z]/g, (letter) =>
    String(letter.charCodeAt(0) - IBAN_LETTER_OFFSET),
  );
}

/**
 * @param iban - an IBAN in canonical form.
 * @returns the remainder of the ISO 13616 mod-97 step; `1` means valid.
 */
export function computeIbanRemainder(iban: string): number {
  let remainder = 0;

  for (const char of toIbanNumeric(iban)) {
    remainder = (remainder * 10 + Number(char)) % IBAN_MODULUS;
  }

  return remainder;
}

/**
 * @param value - an IBAN as typed.
 * @returns `true` when the shape **and** the check digits are valid.
 */
export function isValidIban(value: string): boolean {
  const normalized = normalizeIban(value);

  return (
    IBAN_PATTERN.test(normalized) &&
    computeIbanRemainder(normalized) === IBAN_VALID_REMAINDER
  );
}
