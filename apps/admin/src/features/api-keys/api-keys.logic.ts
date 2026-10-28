/**
 * Pure rules of the `api-keys` use case.
 *
 * No React, no I/O: what is decided here can be unit-tested with values alone,
 * which is exactly why the failure→form mapping lives here (plan decisions
 * **D8**, **D11** tier 1 and **D13**): the decision is made on the envelope
 * `code`, never by matching message text, and the input is chosen by
 * `issues[].path`, never by guessing from the status.
 */

import { ApiError } from '@callback/api-client';
import { API_ERROR_CODE } from '@callback/shared';
import {
  API_KEY_IDENTIFIER_FIELD_MESSAGE,
  FIELD_INVALID_MESSAGE,
} from '../../lib/error-message.const.js';
import { toErrorMessage } from '../../lib/error-message.js';
import {
  API_KEY_FIELD_PATHS,
  DEFAULT_FIELD_PATH_BY_CODE,
  FIELD_ERROR_CODES,
} from './api-keys.const.js';
import type { ApiKeyFieldErrors, ApiKeyFormFieldName } from './api-keys.interface.js';

/** A failure whose `code` allows field-level reporting (plan `D1`). */
type FieldErrorApiError = ApiError & { readonly code: string };

/**
 * @param path - a `details[].path` value from the error envelope.
 * @returns the matching form field, or `null` when the path is not addressable
 *   (dot paths, array indices, the empty payload path, a field this form does
 *   not own).
 */
function toFieldName(path: string): ApiKeyFormFieldName | null {
  return API_KEY_FIELD_PATHS.find((field) => field === path) ?? null;
}

/**
 * @param error - any thrown value.
 * @returns `true` only for an `ApiError` whose non-null `code` is in the
 *   allow-list — a `409` without a code, or with a code we do not map, is not
 *   allowed to blame an input.
 */
function isFieldError(error: unknown): error is FieldErrorApiError {
  return (
    error instanceof ApiError &&
    error.code !== null &&
    FIELD_ERROR_CODES.includes(error.code)
  );
}

/**
 * @param code - an allowed error code.
 * @returns the Hungarian field copy; the server's own `issue.message` is never
 *   used, it is an English developer sentence (plan `D4`).
 */
function toFieldMessage(code: string): string {
  return code === API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT
    ? API_KEY_IDENTIFIER_FIELD_MESSAGE
    : FIELD_INVALID_MESSAGE;
}

/**
 * Collects the addressable issues of one failure.
 *
 * The **first** issue per path wins (plan `D3`): the server emits issues in
 * validator order, so the first one is both deterministic and the most specific.
 *
 * @param issues - the envelope's field-level details.
 * @param message - the copy every mapped field receives.
 * @returns the mapped fields plus whether an unmappable path was seen.
 */
function collectFields(
  issues: readonly { readonly path: string }[],
  message: string,
): { readonly fields: Partial<Record<ApiKeyFormFieldName, string>>; readonly hasUnmapped: boolean } {
  const fields: Partial<Record<ApiKeyFormFieldName, string>> = {};
  let hasUnmapped = false;

  for (const issue of issues) {
    const field = toFieldName(issue.path);

    if (field === null) {
      hasUnmapped = true;
      continue;
    }

    fields[field] ??= message;
  }

  return { fields, hasUnmapped };
}

/**
 * Maps a create failure onto the create form.
 *
 * Decision order (plan `D1`–`D5`):
 *
 * 1. anything that is not an `ApiError` with an allowed code → page-level copy;
 * 2. `issues[]` present → every addressable path becomes a field message, and
 *    the page gets one copy only if some path could not be addressed;
 * 3. `issues[]` empty → the code's default path (a duplicate identifier still
 *    lands on `identifier`), otherwise page-level copy.
 *
 * @param error - whatever the mutation rejected with.
 * @returns the field messages plus the optional page-level message; `form` is
 *   `null` whenever the whole failure was explained by fields.
 */
export function toFieldErrors(error: unknown): ApiKeyFieldErrors {
  if (!isFieldError(error)) {
    return { fields: {}, form: toErrorMessage(error) };
  }

  const message = toFieldMessage(error.code);

  if (error.issues.length > 0) {
    const { fields, hasUnmapped } = collectFields(error.issues, message);

    return { fields, form: hasUnmapped ? toErrorMessage(error) : null };
  }

  const defaultPath = DEFAULT_FIELD_PATH_BY_CODE[error.code];

  if (defaultPath === undefined) {
    return { fields: {}, form: toErrorMessage(error) };
  }

  return { fields: { [defaultPath]: message }, form: null };
}
