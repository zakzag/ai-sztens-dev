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
import type { ApiErrorDetail } from '@callback/shared';
import type { AppErrorInit } from './app-error.interface.js';
import { NOT_FOUND_MESSAGE } from './api-messages.const.js';

/** Base class of every failure the application raises on purpose. */
export class AppError extends Error {
  /** Machine-readable, locale-independent decision key. */
  public readonly code: string;
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
    code: string = API_ERROR_CODE.CONFLICT,
    details: readonly ApiErrorDetail[] = [],
  ) {
    super({ code, message, details });
    this.name = 'ConflictAppError';
  }
}
