/**
 * The shared Hungarian tax number schema (AIS-112).
 *
 * Three failure modes, three reasons, two copies: a wrong *shape* and a
 * well-formed number with an out-of-range code both mean “this is not a tax
 * number” (`TAX_NUMBER`), while a wrong check digit (`TAX_NUMBER_CHECKSUM`)
 * means “you mistyped one digit” — a much more actionable sentence.
 */

import { z } from 'zod';
import { addValidationIssue } from './format-check.helper.js';
import {
  hasValidHuTaxNumberCheckDigit,
  hasValidHuTaxNumberParts,
  parseHuTaxNumber,
} from './hu-tax-number.helper.js';

/** Hungarian tax number in `XXXXXXXX-Y-ZZ` form. */
export const huTaxNumberSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const parts = parseHuTaxNumber(value);

    if (parts === null) {
      addValidationIssue(ctx, 'TAX_NUMBER');

      return;
    }

    if (!hasValidHuTaxNumberCheckDigit(parts.body)) {
      addValidationIssue(ctx, 'TAX_NUMBER_CHECKSUM');

      return;
    }

    if (!hasValidHuTaxNumberParts(parts)) {
      addValidationIssue(ctx, 'TAX_NUMBER');
    }
  });
