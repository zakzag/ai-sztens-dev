/**
 * The zod error map of the shared contract (AIS-112 plan `D2`).
 *
 * Two audiences, one map:
 *
 * - the **server** uses it (implicitly, through the default `en` locale) so a
 *   `400` envelope carries readable English developer text;
 * - the **admin SPA** passes it to `zodResolver` **and** switches the locale to
 *   `hu`, so the same schema renders Hungarian field errors.
 *
 * It is a value, not a side effect: importing `@callback/shared` never calls
 * `z.setErrorMap`, because that would change every schema of the importing
 * process — including the API's — behind the caller's back.
 */

import type { ZodErrorMap } from 'zod';
import { toValidationErrorMessage } from './validation-error-map.logic.js';

/**
 * Locale-aware map for zod-generated issues (`too_small`, `invalid_string`, …).
 *
 * An unmapped code falls back to zod's own default text (`ctx.defaultError`)
 * instead of switching language silently.
 */
export const VALIDATION_ERROR_MAP: ZodErrorMap = (issue, ctx) => ({
  message: toValidationErrorMessage(issue) ?? ctx.defaultError,
});
