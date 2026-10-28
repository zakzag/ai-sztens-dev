/**
 * The single error type every failure of this package is normalised into.
 *
 * Callers (query hooks, forms) must never have to inspect a `Response` or a
 * `ZodError`: the reason is always answerable from the fields below.
 *
 * `code` is the **decision key** (plan `D3`): it is stable, locale independent
 * and never a human sentence. `status` is kept for the cases where a proxy
 * (Caddy `502`, nginx `504`) answers with something that is not our envelope —
 * the tolerant path of plan `D12` — and `details` keeps the rendered lines the
 * existing UI already consumes, so enriching the error breaks no caller.
 */

import type { ApiErrorDetail } from '@callback/shared';
import {
  API_ERROR_NAME,
  HTTP_STATUS,
  UNPARSEABLE_ERROR_MESSAGE,
} from './api-error.const.js';
import type {
  ApiErrorEnvelopeBody,
  ApiErrorInit,
  ParsedErrorBody,
} from './api-error.interface.js';

/** Normalised failure of an API call. */
export class ApiError extends Error {
  /** HTTP status, or `null` when no response was received. */
  readonly status: number | null;
  /** Absolute request URL, for logs and error reports. */
  readonly url: string | null;
  /** Stable machine code from the error envelope (`null` when not provided). */
  readonly code: string | null;
  /** Correlation id of the failed request (`null` when not provided). */
  readonly requestId: string | null;
  /** Field-level issues (`[]` when the API sent none or the body was legacy). */
  readonly issues: readonly ApiErrorDetail[];
  /** Rendered detail lines (`path: message`); kept for existing callers. */
  readonly details: readonly string[];

  /**
   * @param init - message, status, url, code, requestId, issues, details, cause.
   */
  constructor(init: ApiErrorInit) {
    super(init.message, { cause: init.cause });
    this.name = API_ERROR_NAME;
    this.status = init.status;
    this.url = init.url ?? null;
    this.code = init.code ?? null;
    this.requestId = init.requestId ?? null;
    this.issues = init.issues ?? [];
    this.details = init.details ?? [];
  }
}

/** @returns `true` for a non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @returns the value when it is a non-blank string, else `null`. */
function toNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** Renders one issue the way the UI lists it. */
function toDetailLine(detail: ApiErrorDetail): string {
  return detail.path.length > 0 ? `${detail.path}: ${detail.message}` : detail.message;
}

/** @returns one `{ path, message }` entry, or `null` for a malformed detail. */
function toApiErrorDetail(value: unknown): ApiErrorDetail | null {
  if (!isRecord(value)) {
    return null;
  }

  const path = typeof value['path'] === 'string' ? value['path'] : null;
  const message = toNonEmptyString(value['message']);

  return path !== null && message !== null ? { path, message } : null;
}

/** Fallback for a body that carries nothing usable. */
const EMPTY_PARSED_BODY: ParsedErrorBody = {
  message: null,
  code: null,
  requestId: null,
  issues: [],
  details: [],
};

/**
 * Parses the contract's `{ error: { … } }` body.
 *
 * @param body - untrusted response body.
 * @returns the parsed facts, or `null` when the body is not an error envelope.
 */
function parseEnvelopeError(body: unknown): ParsedErrorBody | null {
  if (!isRecord(body)) {
    return null;
  }

  const error = (body as ApiErrorEnvelopeBody).error;

  if (!isRecord(error)) {
    return null;
  }

  const rawDetails = error['details'];
  const issues = Array.isArray(rawDetails)
    ? rawDetails
        .map(toApiErrorDetail)
        .filter((detail): detail is ApiErrorDetail => detail !== null)
    : [];

  return {
    message: toNonEmptyString(error['message']),
    code: toNonEmptyString(error['code']),
    requestId: toNonEmptyString(error['requestId']),
    issues,
    details: issues.map(toDetailLine),
  };
}

/**
 * Parses Nest's legacy body (`{ statusCode, message: string | string[] }`).
 *
 * @param body - untrusted response body.
 * @returns the parsed facts, or `null` when no message is present.
 */
function parseLegacyError(body: unknown): ParsedErrorBody | null {
  if (!isRecord(body)) {
    return null;
  }

  const raw = body['message'];
  const lines =
    typeof raw === 'string'
      ? raw.length > 0
        ? [raw]
        : []
      : Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [];

  if (lines.length === 0) {
    return null;
  }

  return {
    message: lines[0] ?? null,
    code: null,
    requestId: null,
    issues: [],
    details: lines,
  };
}

/**
 * Extracts everything the client can learn from an untrusted error body.
 *
 * The envelope is tried first; a proxy page or a Nest default body degrades to
 * the legacy shape instead of throwing, so the HTTP status always survives even
 * when the body does not.
 *
 * @param body - parsed JSON body, or `null` when parsing failed.
 * @returns the parsed facts; an empty result when nothing was usable.
 */
export function parseErrorBody(body: unknown): ParsedErrorBody {
  return parseEnvelopeError(body) ?? parseLegacyError(body) ?? EMPTY_PARSED_BODY;
}

/**
 * Reads the rendered detail lines out of an untrusted error body.
 *
 * @param body - parsed JSON body, or `null` when parsing failed.
 * @returns `[]` when the body carries no message and no detail.
 */
export function extractErrorDetails(body: unknown): readonly string[] {
  return parseErrorBody(body).details;
}

/**
 * Builds the technical message for a failed response.
 *
 * @param body - parsed JSON body, or `null`.
 * @param statusText - the response's status text, used as the last resort.
 */
export function toFailureMessage(body: unknown, statusText: string): string {
  const parsed = parseErrorBody(body);
  const [first] = parsed.details;

  if (parsed.message !== null) {
    return parsed.message;
  }

  if (first !== undefined) {
    return first;
  }

  return statusText.length > 0 ? statusText : UNPARSEABLE_ERROR_MESSAGE;
}

/** @returns `true` for a duplicate-identifier (409) failure. */
export function isConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === HTTP_STATUS.CONFLICT;
}

/** @returns `true` for a payload validation (400/422) failure. */
export function isValidationError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    (error.status === HTTP_STATUS.BAD_REQUEST ||
      error.status === HTTP_STATUS.UNPROCESSABLE_ENTITY)
  );
}

/** @returns `true` for a missing resource (404) failure. */
export function isNotFoundError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === HTTP_STATUS.NOT_FOUND;
}

/** @returns `true` when the request never reached the server. */
export function isNetworkError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === null;
}
