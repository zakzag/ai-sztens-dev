/**
 * Hungarian tax number (`adószám`) parsing and check digit (AIS-112).
 *
 * The eight-digit body ends with a **check digit** derived from the first seven
 * with the weights `9, 7, 3, 1, 9, 7, 3`:
 *
 * ```text
 * check = (10 - (Σ digitᵢ × weightᵢ mod 10)) mod 10
 * ```
 *
 * A shape-only rule would accept `12345678-1-23`, which no taxpayer holds — the
 * algorithm is what turns a typo into a field error instead of a rejected
 * invoice months later.
 */

import {
  HU_TAX_NUMBER_AREA_CODE_MAX,
  HU_TAX_NUMBER_AREA_CODE_MIN,
  HU_TAX_NUMBER_CHECK_DIGIT_WEIGHTS,
  HU_TAX_NUMBER_PATTERN,
  HU_TAX_NUMBER_VAT_CODE_MAX,
  HU_TAX_NUMBER_VAT_CODE_MIN,
} from './format.const.js';
import type { HuTaxNumberParts } from './hu-tax-number.interface.js';

/**
 * @param value - a formatted tax number (`XXXXXXXX-Y-ZZ`).
 * @returns the parsed parts, or `null` when the shape is wrong.
 */
export function parseHuTaxNumber(value: string): HuTaxNumberParts | null {
  const match = HU_TAX_NUMBER_PATTERN.exec(value);

  if (match === null) {
    return null;
  }

  return {
    body: match[1] ?? '',
    vatCode: Number(match[2]),
    areaCode: Number(match[3]),
  };
}

/**
 * @param body - the eight-digit body of a tax number.
 * @returns the check digit the first seven digits imply.
 */
export function computeHuTaxNumberCheckDigit(body: string): number {
  const weightedSum = HU_TAX_NUMBER_CHECK_DIGIT_WEIGHTS.reduce(
    (sum, weight, index) => sum + Number(body.charAt(index)) * weight,
    0,
  );

  return (10 - (weightedSum % 10)) % 10;
}

/**
 * @param body - the eight-digit body of a tax number.
 * @returns `true` when its last digit matches the computed check digit.
 */
export function hasValidHuTaxNumberCheckDigit(body: string): boolean {
  return Number(body.charAt(body.length - 1)) === computeHuTaxNumberCheckDigit(body);
}

/**
 * @param parts - the parsed tax number.
 * @returns `true` when the VAT code and the area code are in range.
 */
export function hasValidHuTaxNumberParts(parts: HuTaxNumberParts): boolean {
  return (
    parts.vatCode >= HU_TAX_NUMBER_VAT_CODE_MIN &&
    parts.vatCode <= HU_TAX_NUMBER_VAT_CODE_MAX &&
    parts.areaCode >= HU_TAX_NUMBER_AREA_CODE_MIN &&
    parts.areaCode <= HU_TAX_NUMBER_AREA_CODE_MAX
  );
}

/**
 * @param value - a formatted tax number.
 * @returns `true` when the shape, the check digit and both codes are valid.
 */
export function isValidHuTaxNumber(value: string): boolean {
  const parts = parseHuTaxNumber(value);

  return (
    parts !== null &&
    hasValidHuTaxNumberCheckDigit(parts.body) &&
    hasValidHuTaxNumberParts(parts)
  );
}
