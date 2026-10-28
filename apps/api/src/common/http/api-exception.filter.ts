/**
 * The single error → response boundary (AIS-91, plan `D3`, `D7`).
 *
 * Every throwable that escapes a controller, pipe, guard or service ends up
 * here, so the client only ever sees one error shape:
 *
 * - the status comes from the catalogue (`code` → status), never from a
 *   hand-written number at a call site;
 * - 5xx bodies are sanitised by {@link toAppError} (details stay in the log);
 * - the resolved `requestId` is echoed as `X-Request-Id`, which is what makes a
 *   user report traceable to exactly one server log line;
 * - routes marked with `@SkipEnvelope()` reproduce Nest's raw error body, so the
 *   Docker healthcheck and the VAPI webhooks keep their contract.
 *
 * Registered as `APP_FILTER` from {@link HttpModule}; it is never thrown or
 * instantiated by hand in production code.
 */

import { Catch, HttpException, Logger } from '@nestjs/common';
import type {
  ArgumentsHost,
  ExceptionFilter,
  ExecutionContext,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { HTTP_STATUS } from '@callback/shared';
import { ApiResponseService } from './api-response.service.js';
import { INTERNAL_ERROR_MESSAGE } from './api-messages.const.js';
import { SKIP_ENVELOPE_KEY } from './skip-envelope.const.js';
import { toRequestContext } from './request-context.js';
import type {
  HttpReplyLike,
  HttpRequestLike,
  RequestContext,
} from './request-context.interface.js';
import { toAppError } from './to-app-error.js';

/** Body Nest produces for an exemption route, so the old contract survives. */
function toExemptBody(exception: unknown, status: number): unknown {
  if (exception instanceof HttpException) {
    return exception.getResponse();
  }

  return { statusCode: status, message: INTERNAL_ERROR_MESSAGE };
}

/**
 * @param exception - the caught throwable.
 * @returns the status a **non-exempt** error would have, used only for logging
 *   and for the exempt body.
 */
function resolveExceptionStatus(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  return HTTP_STATUS.INTERNAL_SERVER_ERROR;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter<unknown> {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(
    private readonly responses: ApiResponseService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * @param exception - whatever was thrown; never trusted.
   * @param host - Nest's arguments host of the current request.
   */
  public catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      // No other transport exists today; log loudly instead of pretending the
      // error was handled (and never swallow it silently).
      this.logger.error(
        `Unhandled non-HTTP exception: ${describe(exception)}`,
        stackOf(exception),
      );
      return;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<HttpRequestLike>();
    const reply = http.getResponse<HttpReplyLike>();
    const ctx = toRequestContext(request);
    const exempt = this.isExempt(host);
    const fallbackStatus = resolveExceptionStatus(exception);

    let status = fallbackStatus;
    let body: unknown;

    if (exempt) {
      body = toExemptBody(exception, fallbackStatus);
    } else {
      const errorBody = this.responses.fail(toAppError(exception), ctx);
      status = errorBody.error.status;
      body = errorBody;
    }

    this.log(exception, status, ctx);
    reply.header('X-Request-Id', ctx.requestId);
    reply.status(status).send(body);
  }

  /**
   * @returns `true` when the matched handler or its controller opted out.
   *
   * The host arrives typed as `ArgumentsHost` (that is the `ExceptionFilter`
   * contract), but an exception always reaches the filter through the HTTP
   * context, which is an {@link ExecutionContext} and therefore exposes the
   * handler and the controller class the metadata is attached to.
   */
  private isExempt(host: ArgumentsHost): boolean {
    const context = host as ExecutionContext;
    const targets = [context.getHandler(), context.getClass()];

    return (
      this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, targets) ===
      true
    );
  }

  /**
   * Writes one structured line per failure.
   *
   * 5xx keeps the stack and the cause chain (that is the *only* place they
   * survive); 4xx is a one-liner, because a rejected payload is not an incident.
   */
  private log(exception: unknown, status: number, ctx: RequestContext): void {
    const line = `${ctx.method} ${ctx.path} -> ${status} (requestId=${ctx.requestId})`;

    if (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${line}: ${describe(exception)}`, stackOf(exception));
      return;
    }

    this.logger.warn(`${line}: ${describe(exception)}`);
  }
}

/** @returns a printable summary of an unknown throwable. */
function describe(exception: unknown): string {
  return exception instanceof Error
    ? `${exception.name}: ${exception.message}`
    : String(exception);
}

/** @returns the stack of an unknown throwable, or `undefined`. */
function stackOf(exception: unknown): string | undefined {
  return exception instanceof Error ? exception.stack : undefined;
}
