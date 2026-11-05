/**
 * The shared IBAN schema (AIS-112 plan decision `D4`).
 *
 * Two distinct failures are reported, because they need different fixes: a
 * malformed IBAN (`IBAN` copy) and a well-formed IBAN with wrong check digits
 * (`IBAN_CHECKSUM` copy) — the latter is almost always a typo in the middle.
 */

import { z } from 'zod';
import { addValidationIssue } from './format-check.helper.js';
import { IBAN_PATTERN, IBAN_VALID_REMAINDER } from './format.const.js';
import { computeIbanRemainder, normalizeIban } from './iban.helper.js';

/** Valid IBAN, transformed to the canonical (spaceless, upper-case) form. */
export const ibanSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const normalized = normalizeIban(value);

    if (!IBAN_PATTERN.test(normalized)) {
      addValidationIssue(ctx, 'IBAN');

      return;
    }

    if (computeIbanRemainder(normalized) !== IBAN_VALID_REMAINDER) {
      addValidationIssue(ctx, 'IBAN_CHECKSUM');
    }
  })
  .transform(normalizeIban);
