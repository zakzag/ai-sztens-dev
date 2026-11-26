/**
 * The shared e-mail schema (AIS-112).
 *
 * Normalisation is part of the contract, not of a form: the value is trimmed
 * and lower-cased **before** it is validated, so `  Info@Example.COM ` and
 * `info@example.com` are the same address everywhere. Without that, two users
 * could register what the database sees as two different rows.
 *
 * The rejection message is zod's `invalid_string` issue, translated by the
 * validation error map — English for the API, Hungarian for the UI.
 */

import { z } from 'zod';
import { EMAIL_MAX_LENGTH } from './format.const.js';

/** Trimmed, lower-cased e-mail address. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH)
  .email();
