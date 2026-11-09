/**
 * The shared phone schema (AIS-112 plan decision `D3`).
 *
 * Accepts the ways a Hungarian user actually types a number — `+36 30 123 4567`,
 * `06-30-123-4567`, `(06 30) 123 4567` — and **hands on the E.164 form**, so
 * neither the form nor the repository has to remember to normalise.
 */

import { z } from 'zod';
import { addValidationIssue } from './format-check.helper.js';
import { PHONE_INPUT_MAX_LENGTH } from './format.const.js';
import { isValidPhone, normalizePhone } from './phone.helper.js';

/** Valid phone number, transformed to E.164. */
export const phoneSchema = z
  .string()
  .trim()
  .max(PHONE_INPUT_MAX_LENGTH)
  .superRefine((value, ctx) => {
    if (!isValidPhone(value)) {
      addValidationIssue(ctx, 'PHONE');
    }
  })
  .transform((value) => normalizePhone(value) ?? value);
