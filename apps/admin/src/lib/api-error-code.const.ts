/**
 * The **single** `code` → copy table of the UI (AIS-111, plan `D2`).
 *
 * Before this file there were two hand-maintained tables — `ERROR_CODE_MESSAGE`
 * for the rendered sentence and `FIELD_SURFACE_CODES` for “may this code blame
 * an input” — plus a third re-export in the `api-keys` feature. They drifted:
 * AIS-108 added `STALE_WRITE` and `SEMANTIC_VALIDATION_FAILED` to the shared
 * catalogue and the admin app never learned either, so a lost update rendered
 * the generic conflict sentence.
 *
 * {@link ERROR_CODE_CATALOGUE} is a **total** record over `ApiErrorCode`, so
 * adding a code to `@callback/shared` breaks the build here instead of silently
 * degrading the copy. {@link ERROR_CODE_MESSAGE} and {@link FIELD_SURFACE_CODES}
 * are derived, never written by hand.
 *
 * Only Hungarian literals live in `error-message.const.ts`; this file wires
 * codes to those symbols.
 */

import { API_ERROR_CODE, type ApiErrorCode } from '@callback/shared';
import {
  API_KEY_IDENTIFIER_FIELD_MESSAGE,
  CONFLICT_MESSAGE,
  FIELD_INVALID_MESSAGE,
  FORBIDDEN_MESSAGE,
  IDENTIFIER_CONFLICT_MESSAGE,
  NOT_FOUND_MESSAGE,
  PAYLOAD_TOO_LARGE_MESSAGE,
  RATE_LIMITED_MESSAGE,
  SEMANTIC_VALIDATION_FAILED_MESSAGE,
  SERVER_ERROR_MESSAGE,
  SERVICE_UNAVAILABLE_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  STALE_WRITE_MESSAGE,
  UNEXPECTED_PAYLOAD_USER_MESSAGE,
  VALIDATION_MESSAGE,
} from './error-message.const.js';
import type { ApiErrorCodeCopy } from './api-error-code.interface.js';

/**
 * A client-side code that is **not** part of the server catalogue.
 *
 * The transport emits it when a `200` body does not satisfy the contract, so it
 * has copy but no field capability and no registry entry.
 */
export const CLIENT_UNEXPECTED_PAYLOAD_CODE = 'UNEXPECTED_PAYLOAD';

/**
 * One entry per server code.
 *
 * `fieldMessage: null` is a decision, not an omission: it means the failure is
 * about the request or the resource, never about one input the user typed.
 */
export const ERROR_CODE_CATALOGUE: Readonly<
  Record<ApiErrorCode, ApiErrorCodeCopy>
> = Object.freeze({
  [API_ERROR_CODE.VALIDATION_FAILED]: {
    message: VALIDATION_MESSAGE,
    fieldMessage: FIELD_INVALID_MESSAGE,
  },
  [API_ERROR_CODE.UNAUTHENTICATED]: {
    message: SESSION_EXPIRED_MESSAGE,
    fieldMessage: null,
  },
  [API_ERROR_CODE.FORBIDDEN]: {
    message: FORBIDDEN_MESSAGE,
    fieldMessage: null,
  },
  [API_ERROR_CODE.NOT_FOUND]: {
    message: NOT_FOUND_MESSAGE,
    fieldMessage: null,
  },
  [API_ERROR_CODE.CONFLICT]: {
    message: CONFLICT_MESSAGE,
    fieldMessage: null,
  },
  [API_ERROR_CODE.STALE_WRITE]: {
    message: STALE_WRITE_MESSAGE,
    fieldMessage: null,
  },
  [API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED]: {
    message: SEMANTIC_VALIDATION_FAILED_MESSAGE,
    fieldMessage: FIELD_INVALID_MESSAGE,
  },
  [API_ERROR_CODE.PAYLOAD_TOO_LARGE]: {
    message: PAYLOAD_TOO_LARGE_MESSAGE,
    fieldMessage: null,
  },
  [API_ERROR_CODE.RATE_LIMITED]: {
    message: RATE_LIMITED_MESSAGE,
    fieldMessage: null,
  },
  [API_ERROR_CODE.INTERNAL_ERROR]: {
    message: SERVER_ERROR_MESSAGE,
    fieldMessage: null,
  },
  [API_ERROR_CODE.SERVICE_UNAVAILABLE]: {
    message: SERVICE_UNAVAILABLE_MESSAGE,
    fieldMessage: null,
  },
  [API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT]: {
    message: IDENTIFIER_CONFLICT_MESSAGE,
    fieldMessage: API_KEY_IDENTIFIER_FIELD_MESSAGE,
  },
});

/**
 * `code` → rendered sentence, consumed by `toErrorMessage`.
 *
 * Typed `Record<string, …>` on purpose: a code from a newer server than the
 * deployed bundle must degrade to the status fallback, not fail to compile.
 * The client-only {@link CLIENT_UNEXPECTED_PAYLOAD_CODE} is appended, because it
 * exists only on this side of the wire.
 */
export const ERROR_CODE_MESSAGE: Readonly<Record<string, string>> =
  Object.freeze({
    ...Object.fromEntries(
      Object.entries(ERROR_CODE_CATALOGUE).map(([code, copy]) => [
        code,
        copy.message,
      ]),
    ),
    [CLIENT_UNEXPECTED_PAYLOAD_CODE]: UNEXPECTED_PAYLOAD_USER_MESSAGE,
  });

/**
 * The only codes allowed to claim “this input is wrong”.
 *
 * Derived from {@link ERROR_CODE_CATALOGUE}, so the classifier
 * (`toErrorSurface`) and the field mapping (`toFieldErrors`) cannot disagree
 * about which codes may address a form field.
 */
export const FIELD_SURFACE_CODES: readonly string[] = Object.freeze(
  Object.entries(ERROR_CODE_CATALOGUE)
    .filter(([, copy]) => copy.fieldMessage !== null)
    .map(([code]) => code),
);
