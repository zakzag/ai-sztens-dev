/**
 * The application error hierarchy (AIS-90, plan `D7`).
 *
 * Why not `HttpException`: a domain service must stay HTTP-agnostic (it may be
 * called from a worker or a script), and the *status* must not be a second
 * decision next to the code — it is derived from the shared catalogue. The
 * global `ApiExceptionFilter` is the only place that turns these into a
 * response.
 *
 * Adding a failure mode = adding a subclass (or passing a domain-specific code
 * with the same status), never editing the filter.
 */

import { API_ERROR_CODE, resolveApiErrorStatus } from '@callback/shared';
import type { ApiErrorCode, ApiErrorDetail } from '@callback/shared';
import type { AppErrorInit } from './app-error.interface.js';
import {
  NOT_FOUND_MESSAGE,
  STALE_UPDATED_AT_DETAIL,
} from './api-messages.const.js';

/** Base class of every failure the application raises on purpose. */
export class AppError extends Error {
  /** Machine-readable, locale-independent decision key. */
  public readonly code: ApiErrorCode;
  /** Field-level issues (`[]` when no field is at fault). */
  public readonly details: readonly ApiErrorDetail[];

  /**
   * @param init - code, developer message, optional details and cause.
   */
  constructor(init: AppErrorInit) {
    super(init.message, { cause: init.cause });
    this.name = 'AppError';
    this.code = init.code;
    this.details = init.details ?? [];
  }

  /** HTTP status the catalogue assigns to {@link AppError.code}. */
  public get status(): number {
    return resolveApiErrorStatus(this.code);
  }
}

/** A payload or query did not match the shared contract. */
export class ValidationAppError extends AppError {
  /**
   * @param message - developer-facing summary.
   * @param details - one `{ path, message }` entry per offending field.
   */
  constructor(message: string, details: readonly ApiErrorDetail[]) {
    super({ code: API_ERROR_CODE.VALIDATION_FAILED, message, details });
    this.name = 'ValidationAppError';
  }
}

/** The addressed resource does not exist. */
export class NotFoundAppError extends AppError {
  /**
   * @param message - developer-facing summary (defaults to a neutral sentence).
   */
  constructor(message: string = NOT_FOUND_MESSAGE) {
    super({ code: API_ERROR_CODE.NOT_FOUND, message });
    this.name = 'NotFoundAppError';
  }
}

/** A uniqueness or state conflict; the default status is `409`. */
export class ConflictAppError extends AppError {
  /**
   * @param message - developer-facing summary.
   * @param code - a `409` code; defaults to the generic `CONFLICT`, override it
   *   with a domain-specific code so the client can be more precise.
   * @param details - field-level issues (e.g. the conflicting `identifier`).
   */
  constructor(
    message: string,
    code: ApiErrorCode = API_ERROR_CODE.CONFLICT,
    details: readonly ApiErrorDetail[] = [],
  ) {
    super({ code, message, details });
    this.name = 'ConflictAppError';
  }
}

/**
 * Optimistic concurrency failure (AIS-108): the client wrote against a version
 * that is no longer current.
 *
 * A subclass of its own rather than a `ConflictAppError` with the
 * `STALE_WRITE` code, because the *retry advice* differs: a uniqueness conflict
 * means “pick another value”, a stale write means “re-read, re-apply, resend”.
 * The detail always names `updatedAt`, which is the field the client has to
 * refresh before retrying.
 */
export class StaleWriteAppError extends AppError {
  /**
   * @param message - developer-facing summary.
   * @param details - field-level issues; defaults to the `updatedAt` entry,
   *   because a stale write is always about that token.
   */
  constructor(
    message: string,
    details: readonly ApiErrorDetail[] = [STALE_UPDATED_AT_DETAIL],
  ) {
    super({ code: API_ERROR_CODE.STALE_WRITE, message, details });
    this.name = 'StaleWriteAppError';
  }
}

/**
 * The request shape is valid, its content is not (AIS-108).
 *
 * `422`, not `400`: nothing about the JSON is malformed, so telling the client
 * “your payload is invalid” would send it looking for a syntax problem. What is
 * wrong is the *value* (an expiry in the past), and that is what `details`
 * names.
 */
export class SemanticValidationAppError extends AppError {
  /**
   * @param message - developer-facing summary.
   * @param details - one `{ path, message }` entry per offending field.
   */
  constructor(message: string, details: readonly ApiErrorDetail[]) {
    super({
      code: API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED,
      message,
      details,
    });
    this.name = 'SemanticValidationAppError';
  }
}
