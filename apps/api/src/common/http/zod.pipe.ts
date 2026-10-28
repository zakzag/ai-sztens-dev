/**
 * Zod validation pipes of the HTTP edge (AIS-90, plan `D6`).
 *
 * Why a pipe instead of the class-validator `ValidationPipe`: the contract is
 * defined **once** in `@callback/shared`, and `createApiKeySchema` is what the
 * client already uses. Validating the server with a *different* description
 * (decorated DTO classes) is exactly the three-truths problem the story removes.
 *
 * `ZodBodyPipe` receives the parsed JSON body; `ZodQueryPipe` receives the raw
 * query object, so its schema is expected to coerce (`z.coerce.number()`), which
 * is why the two exist as separate names instead of one anonymous class.
 *
 * Strictness is a **schema** property, not a pipe flag: a request schema declares
 * `.strict()` (`createApiKeySchema` does), which keeps the old
 * `forbidNonWhitelisted` semantics — an undeclared key is a `400`, never a silent
 * strip — while response schemas stay tolerant of additive backend fields.
 * Rewriting the schema inside the pipe would make that decision invisible.
 */

import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { ValidationAppError } from './app-error.js';
import { VALIDATION_FAILED_MESSAGE } from './api-messages.const.js';
import { toApiErrorDetails } from './zod-error.mapper.js';

/**
 * Validates any untrusted value against a shared zod schema.
 *
 * @throws {ValidationAppError} carrying `details[]` — never a bare `Error`,
 *   because the filter needs a code to build the envelope.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  /**
   * @param schema - the contract schema (with its transform, if any).
   */
  constructor(private readonly schema: z.ZodType<T, z.ZodTypeDef, unknown>) {}

  /**
   * @param value - the untrusted value Nest hands over.
   * @returns the parsed, typed value.
   */
  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new ValidationAppError(
        VALIDATION_FAILED_MESSAGE,
        toApiErrorDetails(result.error),
      );
    }

    return result.data;
  }
}

/** Validates a JSON request body (`@Body(new ZodBodyPipe(schema))`). */
export class ZodBodyPipe<T> extends ZodValidationPipe<T> {}

/** Validates a query string (`@Query(new ZodQueryPipe(schema))`). */
export class ZodQueryPipe<T> extends ZodValidationPipe<T> {}
