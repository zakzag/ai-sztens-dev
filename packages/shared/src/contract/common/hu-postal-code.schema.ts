/**
 * Hungarian postal code (`irányítószám`) schema (AIS-112).
 *
 * Only the *shape* is checked: exactly four digits. The numeric range
 * (1000–9985) is deliberately **not** enforced — a range rule would reject
 * newly allocated codes, and the field is a delivery hint, not a key.
 */

import { z } from 'zod';
import { patternCheck } from './format-check.helper.js';
import { HU_POSTAL_CODE_PATTERN } from './format.const.js';

/** Four-digit Hungarian postal code. */
export const huPostalCodeSchema = z
  .string()
  .trim()
  .superRefine(patternCheck(HU_POSTAL_CODE_PATTERN, 'POSTAL_CODE'));
