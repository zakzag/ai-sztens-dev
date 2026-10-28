/**
 * The envelope layer (AIS-91, plan `D7`).
 *
 * Deliberately thin: it adds **no** business logic, it only calls the pure
 * factories from `@callback/shared` with the request context. Two reasons for
 * keeping it this small:
 *
 * 1. the wire shape is testable without Nest (the factories are pure);
 * 2. a controller either calls `ok()` or does not ship — there is no implicit
 *    wrapping magic that could hide which response has which shape.
 *
 * Services stay HTTP-agnostic: only the controller wraps, and only the exception
 * filter wraps failures.
 */

import { Injectable } from '@nestjs/common';
import {
  toErrorEnvelope,
  toSuccessEnvelope,
  type ApiEnvelope,
  type ApiErrorEnvelope,
  type PaginationMeta,
} from '@callback/shared';
import type { AppError } from './app-error.js';
import type { RequestContext } from './request-context.interface.js';

@Injectable()
export class ApiResponseService {
  /**
   * Builds a success body.
   *
   * @param data - the payload; `null` only when the call has nothing to return.
   * @param ctx - request context (`requestId` + `timestamp` become `meta`).
   * @param pagination - `meta.pagination`, only on a paginated list.
   */
  public ok<T>(
    data: T,
    ctx: RequestContext,
    pagination?: PaginationMeta,
  ): ApiEnvelope<T> {
    const meta =
      pagination === undefined
        ? { requestId: ctx.requestId, timestamp: ctx.timestamp }
        : { requestId: ctx.requestId, timestamp: ctx.timestamp, pagination };

    return toSuccessEnvelope(data, meta);
  }

  /**
   * Builds an error body.
   *
   * `status` is not passed in: the shared catalogue derives it from `code`, so
   * the body can never disagree with the response status the filter sets.
   *
   * @param error - the normalised application error.
   * @param ctx - request context (`requestId`, `timestamp`, `path`).
   */
  public fail(error: AppError, ctx: RequestContext): ApiErrorEnvelope {
    return toErrorEnvelope(
      {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      ctx,
    );
  }
}
