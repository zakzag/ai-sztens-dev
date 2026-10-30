/**
 * Normalises **any** throwable into an {@link AppError} (plan `D7`, `D3`).
 *
 * This is the only place that knows about foreign error types:
 *
 * | throwable | becomes |
 * |---|---|
 * | `AppError` | itself, 5xx messages sanitised |
 * | `ZodError` | `VALIDATION_FAILED` with field details |
 * | Nest `HttpException` | the closest catalogue code (its message is kept for 4xx) |
 * | anything else | `INTERNAL_ERROR` with a fixed message |
 *
 * The 5xx branch is the security boundary: whatever the original error said —
 * SQL text, a constraint name, a stack — it never reaches the client. Only the
 * `requestId` links the sanitised body to the full server log.
 */

import { HttpException } from '@nestjs/common';
import { ZodError } from 'zod';
import { API_ERROR_CODE } from '@callback/shared';
import type { ApiErrorDetail } from '@callback/shared';
import { AppError, ValidationAppError } from './app-error.js';
import { toApiErrorCode } from './api-error-code.mapper.js';
import {
  INTERNAL_ERROR_MESSAGE,
  VALIDATION_FAILED_MESSAGE,
} from './api-messages.const.js';
import { toApiErrorDetails } from './zod-error.mapper.js';

/** A plain object we may read unknown properties from. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @returns the first non-blank string of a `message` field, or `undefined`.
 */
function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.length > 0 ? value : undefined;
  }

  if (Array.isArray(value)) {
    return value.find(
      (item): item is string => typeof item === 'string' && item.length > 0,
    );
  }

  return undefined;
}

/**
 * Reads a developer message out of a Nest exception response.
 *
 * @param response - `HttpException.getResponse()` (a string or an object).
 * @param fallback - used when the response carries no usable text.
 */
function readExceptionMessage(response: unknown, fallback: string): string {
  if (typeof response === 'string') {
    return response.length > 0 ? response : fallback;
  }

  if (isRecord(response)) {
    return firstString(response['message']) ?? fallback;
  }

  return fallback;
}

/**
 * Reads the validator messages of a Nest exception into the contract's shape.
 *
 * A Nest exception may carry `message: string[]` (the shape the retired
 * class-validator `ValidationPipe` produced, and what a guard or a third-party
 * library can still throw). Those entries have no field path, so every one of
 * them becomes a whole-payload detail (`path: ''`).
 * @param response - `HttpException.getResponse()`.
 */
function readExceptionDetails(response: unknown): readonly ApiErrorDetail[] {
  if (!isRecord(response)) {
    return [];
  }

  const message = response['message'];

  if (!Array.isArray(message)) {
    return [];
  }

  return message
    .filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    )
    .map((item) => ({ path: '', message: item }));
}

/**
 * Replaces the message of a 5xx `AppError` with the fixed generic sentence.
 *
 * @param error - the error raised by a service.
 * @returns the original error for 4xx, a sanitised copy for 5xx.
 */
function sanitize(error: AppError): AppError {
  if (error.status < 500) {
    return error;
  }

  return new AppError({
    code: error.code,
    message: INTERNAL_ERROR_MESSAGE,
    cause: error,
  });
}

/**
 * Converts a Nest `HttpException` (or anything a guard throws) to an `AppError`.
 *
 * @param exception - the caught exception.
 */
function fromHttpException(exception: HttpException): AppError {
  const status = exception.getStatus();
  const code = toApiErrorCode(status);
  const response = exception.getResponse();

  if (status >= 500) {
    return new AppError({
      code,
      message: INTERNAL_ERROR_MESSAGE,
      cause: exception,
    });
  }

  return new AppError({
    code,
    message: readExceptionMessage(response, INTERNAL_ERROR_MESSAGE),
    details: readExceptionDetails(response),
    cause: exception,
  });
}

/**
 * @param exception - whatever a controller, pipe, guard or service threw.
 * @returns the `AppError` the filter can serialise.
 */
export function toAppError(exception: unknown): AppError {
  if (exception instanceof AppError) {
    return sanitize(exception);
  }

  if (exception instanceof ZodError) {
    return new ValidationAppError(
      VALIDATION_FAILED_MESSAGE,
      toApiErrorDetails(exception),
    );
  }

  if (exception instanceof HttpException) {
    return fromHttpException(exception);
  }

  return new AppError({
    code: API_ERROR_CODE.INTERNAL_ERROR,
    message: INTERNAL_ERROR_MESSAGE,
    cause: exception,
  });
}
