/**
 * The single failure → form mapping of the UI (AIS-111).
 *
 * Nothing here is feature-specific: the caller passes the paths its form owns and
 * — optionally — which path a code should blame when the envelope carried no
 * `issues[]`. Before this file the same logic lived inside
 * `features/api-keys/api-keys.logic.ts`, so every new resource would have copied
 * it.
 *
 * The decisions are made on the envelope `code`, never by matching message text,
 * and the input is chosen by `issues[].path`, never by guessing from the status.
 * Reaching *which tier renders the failure* stays the job of
 * {@link toErrorSurface}; this module only answers “which inputs, with what copy”.
 */

import { ApiError } from '@callback/api-client';
import type { ApiErrorCode } from '@callback/shared';
import { ERROR_CODE_CATALOGUE } from './api-error-code.const.js';
import { toErrorMessage } from './error-message.js';
import { isAbortLike } from './error-surface.logic.js';
import type {
  FieldErrorMapping,
  FieldErrorTarget,
} from './field-errors.interface.js';

/** A code that is allowed to blame an input, plus the copy it blames it with. */
interface FieldErrorCode {
  readonly code: string;
  readonly message: string;
}

/**
 * @param error - a normalised transport failure.
 * @returns the code and its field copy, or `null` when the code may not claim
 *   “this input is wrong” — a `CONFLICT` from a proxy, a `500`, a `STALE_WRITE`
 *   that blames a hidden concurrency token, or a code newer than this bundle.
 */
function toFieldErrorCode(error: ApiError): FieldErrorCode | null {
  const { code } = error;

  if (code === null || !Object.hasOwn(ERROR_CODE_CATALOGUE, code)) {
    return null;
  }

  const { fieldMessage } = ERROR_CODE_CATALOGUE[code as ApiErrorCode];

  return fieldMessage === null ? null : { code, message: fieldMessage };
}

/**
 * Collects the addressable issues of one failure.
 *
 * The **first** issue per path wins: the server emits issues in validator order,
 * so the first one is both deterministic and the most specific.
 *
 * @param issues - the envelope's field-level details.
 * @param owned - the paths the form actually renders.
 * @param message - the copy every mapped field receives.
 * @returns the mapped fields plus whether an unaddressable path was seen.
 */
function collectFields<F extends string>(
  issues: readonly { readonly path: string }[],
  owned: ReadonlySet<string>,
  message: string,
): {
  readonly fields: Partial<Record<F, string>>;
  readonly hasUnmapped: boolean;
} {
  const fields: Partial<Record<F, string>> = {};
  let hasUnmapped = false;

  for (const issue of issues) {
    if (!owned.has(issue.path)) {
      hasUnmapped = true;
      continue;
    }

    const field = issue.path as F;

    fields[field] ??= message;
  }

  return { fields, hasUnmapped };
}

/**
 * Maps a mutation failure onto the form that submitted it.
 *
 * Decision order is frozen:
 *
 * 1. a cancellation → nothing at all (the user or an unmount walked away, and
 *    `toErrorSurface` classifies the same value as `silent`);
 * 2. anything that is not an `ApiError`, or a code outside the field allow-list →
 *    page-level copy from `toErrorMessage`;
 * 3. `issues[]` present → every owned path becomes a field message, and the page
 *    gets one copy only if some path could not be addressed;
 * 4. `issues[]` empty → the code's default path (a duplicate identifier still
 *    lands on `identifier`), otherwise page-level copy.
 *
 * @param error - whatever the mutation rejected with; never trusted.
 * @param target - the field paths the form owns plus its optional default map.
 * @returns the field messages plus the optional page-level message; `form` is
 *   `null` whenever the whole failure was explained by fields.
 */
export function toFieldErrors<F extends string>(
  error: unknown,
  target: FieldErrorTarget<F>,
): FieldErrorMapping<F> {
  const fields: Partial<Record<F, string>> = {};

  if (isAbortLike(error)) {
    return { fields, form: null };
  }

  if (!(error instanceof ApiError)) {
    return { fields, form: toErrorMessage(error) };
  }

  const fieldCode = toFieldErrorCode(error);

  if (fieldCode === null) {
    return { fields, form: toErrorMessage(error) };
  }

  const owned = new Set<string>(target.fieldPaths);

  if (error.issues.length > 0) {
    const collected = collectFields<F>(error.issues, owned, fieldCode.message);

    return {
      fields: collected.fields,
      form: collected.hasUnmapped ? toErrorMessage(error) : null,
    };
  }

  const defaultPath = target.defaultPathByCode?.[fieldCode.code];

  if (defaultPath === undefined || !owned.has(defaultPath)) {
    return { fields, form: toErrorMessage(error) };
  }

  fields[defaultPath] = fieldCode.message;

  return { fields, form: null };
}
