/**
 * Pure rules of the `api-keys` page.
 *
 * Two jobs, both testable with values alone:
 *
 * 1. `apiKeyFormSchema` — client-side validation that mirrors the backend
 *    limits. The numbers and the identifier pattern come from
 *    `@callback/shared`, so the form cannot drift away from the API contract.
 * 2. `toCreateApiKeyInput` — form values → request body. Empty optional fields
 *    are **omitted** (not `null`, not `''`), because the backend DTO declares
 *    them as optional strings and rejects anything else.
 *
 * Why not reuse the shared `createApiKeySchema` for the form? Because it expects
 * an ISO instant in `expiresAt`, while the form holds a calendar day. The wire
 * schema still guards the request on the service side (plan decision D31).
 */

import {
  API_KEY_DESCRIPTION_MAX_LENGTH,
  API_KEY_IDENTIFIER_PATTERN,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_VALUE_MAX_LENGTH,
  type CreateApiKeyInput,
} from '@callback/shared';
import { z } from 'zod';
import { toExpiryIso } from '../../lib/date.js';
import { API_KEY_FORM_VALIDATION_MESSAGES } from './api-keys.const.js';
import type { ApiKeyFormValues } from './api-keys.interface.js';

/**
 * @param value - date input value; may be empty.
 * @returns `true` when {@link toExpiryIso} would accept the value.
 */
function isExpiryInputAccepted(value: string): boolean {
  try {
    toExpiryIso(value);

    return true;
  } catch {
    // `toExpiryIso` signals “not a calendar date” by throwing `RangeError`. For
    // a validation predicate that throw *is* the answer, so it is turned into
    // `false` here and nowhere else — the real conversion stays untouched.
    return false;
  }
}

/**
 * Field rules of the create form.
 *
 * `z.string().trim()` is applied before the length checks, so a name of spaces
 * is rejected instead of being stored as `'   '`.
 */
export const apiKeyFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, API_KEY_FORM_VALIDATION_MESSAGES.nameRequired)
    .max(API_KEY_NAME_MAX_LENGTH, API_KEY_FORM_VALIDATION_MESSAGES.nameTooLong),
  identifier: z
    .string()
    .trim()
    .min(1, API_KEY_FORM_VALIDATION_MESSAGES.identifierRequired)
    .regex(
      API_KEY_IDENTIFIER_PATTERN,
      API_KEY_FORM_VALIDATION_MESSAGES.identifierInvalid,
    ),
  description: z
    .string()
    .trim()
    .max(
      API_KEY_DESCRIPTION_MAX_LENGTH,
      API_KEY_FORM_VALIDATION_MESSAGES.descriptionTooLong,
    ),
  apiKey: z
    .string()
    .trim()
    .min(1, API_KEY_FORM_VALIDATION_MESSAGES.apiKeyRequired)
    .max(API_KEY_VALUE_MAX_LENGTH, API_KEY_FORM_VALIDATION_MESSAGES.apiKeyTooLong),
  expiresAt: z
    .string()
    .refine(isExpiryInputAccepted, API_KEY_FORM_VALIDATION_MESSAGES.expiresAtInvalid),
});

/**
 * Builds the request body of `POST /api/api-keys`.
 *
 * @param values - validated form values.
 * @returns the payload the API expects: trimmed texts, and the optional fields
 *   present only when they carry a value.
 * @throws {RangeError} when `expiresAt` is not a calendar date — unreachable
 *   behind {@link apiKeyFormSchema}, and deliberately loud if it happens.
 */
export function toCreateApiKeyInput(values: ApiKeyFormValues): CreateApiKeyInput {
  const description = values.description.trim();
  const expiresAt = toExpiryIso(values.expiresAt);

  return {
    name: values.name.trim(),
    identifier: values.identifier.trim(),
    apiKey: values.apiKey.trim(),
    ...(description.length > 0 ? { description } : {}),
    ...(expiresAt === undefined ? {} : { expiresAt }),
  };
}
