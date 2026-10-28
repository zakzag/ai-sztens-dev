/**
 * Echoes the resolved correlation id on every response (plan `D10`).
 *
 * Why an interceptor if the plan forbids a *success interceptor*: that decision
 * is about **wrapping** a body implicitly, which would hide the envelope
 * decision from the code. This interceptor does not touch the body at all — it
 * sets one header and hands over, so a browser network tab and a proxy log show
 * the same id as `meta.requestId`.
 *
 * The header is only set when an id can be *read* (inbound header or Fastify's
 * own id); generating a different UUID here would produce a header that
 * disagrees with `meta.requestId`.
 */

import { Injectable } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { REQUEST_ID_RESPONSE_HEADER } from './api-messages.const.js';
import { readRequestId, resolveRequestId } from './request-context.js';
import type {
  HttpReplyLike,
  HttpRequestLike,
} from './request-context.interface.js';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  /**
   * @param context - execution context of the current handler.
   * @param next - the rest of the pipeline (always continued).
   */
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType() === 'http') {
      const http = context.switchToHttp();
      const request = http.getRequest<HttpRequestLike>();
      const reply = http.getResponse<HttpReplyLike>();

      if (
        readRequestId(request.headers) !== undefined ||
        request.id !== undefined
      ) {
        reply.header(REQUEST_ID_RESPONSE_HEADER, resolveRequestId(request));
      }
    }

    return next.handle();
  }
}
