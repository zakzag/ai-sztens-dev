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
 * - routes marked with `@SkipEnvelope()` (and every route on the shared
 *   `ENVELOPE_EXEMPTIONS` allow-list) reproduce Nest's raw error body, so the
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
// IMPORTANT: value import, never `import type`. `Reflector` is a constructor
// parameter of a decorated class, so `emitDecoratorMetadata` has to reference
// the class **at runtime**; a type-only import is erased and the emitted
// `design:paramtypes` becomes `[ApiResponseService, Function]`, which makes Nest
// fail with "Nest can't resolve dependencies of the ApiExceptionFilter
// (ApiResponseService, ?)" and stops the application from booting.
// Guarded by `http-wiring.metadata.spec.ts`.
import { Reflector } from '@nestjs/core';
import { ENVELOPE_EXEMPTIONS, HTTP_STATUS } from '@callback/shared';
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
 * Element type of the target list `Reflector#getAllAndOverride` accepts, taken
 * from Nest's own signature so this file never has to restate it (the list is
 * a union of `Function` and `Type<any>`).
 */
type MetadataTarget = Parameters<Reflector['getAllAndOverride']>[1][number];

/**
 * @param value - a metadata target candidate (a controller class or a handler).
 * @returns `true` when the value can carry `Reflect` metadata. Both a class and
 *   a handler are callable, and an absent target is `undefined`.
 */
function isMetadataTarget(value: unknown): value is MetadataTarget {
  return typeof value === 'function';
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

/**
 * Reads the route pattern the request was matched against.
 *
 * Fastify exposes it as `request.routeOptions.url` (`/api/v1/items/:id`), which
 * is exactly the notation the exemption list uses. The concrete URL (query
 * string stripped) is the fallback for requests that never reached a route.
 *
 * @param host - filter host of the failed request.
 * @returns the route pattern, or `''` when it cannot be read.
 */
function readRoutePattern(host: ArgumentsHost): string {
  const request = host.switchToHttp().getRequest<HttpRequestLike>();
  const pattern: unknown = request.routeOptions?.url;

  if (typeof pattern === 'string' && pattern.length > 0) {
    return pattern;
  }

  const url: unknown = request.url;

  return typeof url === 'string' ? (url.split('?')[0] ?? '') : '';
}

/**
 * @param host - filter host of the failed request.
 * @returns `true` when the failed route is on the documented raw-body list.
 */
function isRegisteredExemption(host: ArgumentsHost): boolean {
  const pattern = readRoutePattern(host);

  return ENVELOPE_EXEMPTIONS.some((entry) => entry.path === pattern);
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
   * @returns `true` when the failed route must keep a raw body.
   *
   * Two independent sources are consulted and **either** is enough:
   *
   * 1. `@SkipEnvelope()` metadata on the matched handler or controller — the
   *    normal path, but the host does not always carry the metadata targets;
   * 2. the documented `ENVELOPE_EXEMPTIONS` allow-list, matched against the
   *    route pattern of the request.
   *
   * Why both: Nest hands the filter more than one host shape. An error thrown by
   * a route handler arrives with a host built from the raw `[req, res, next]`
   * tuple, and a **guard** rejection arrives without a handler/class pair either
   * — so the decorator alone cannot decide. `Reflector` additionally throws
   * `TypeError` on an `undefined` target, which used to crash the filter and
   * rewrite every 4xx into an opaque Fastify 500.
   *
   * Falling back to the registry keeps a guard rejection on `/healthz` or a VAPI
   * webhook in Nest's raw shape, which is the contract those consumers have; the
   * two lists are held in exact agreement by the exemption specs.
   */
  private isExempt(host: ArgumentsHost): boolean {
    return this.hasSkipEnvelopeMetadata(host) || isRegisteredExemption(host);
  }

  /**
   * @returns `true` when the metadata targets present on the host carry
   *   `@SkipEnvelope()` (`false` when the host exposes none).
   */
  private hasSkipEnvelopeMetadata(host: ArgumentsHost): boolean {
    const context = host as ExecutionContext;
    const targets: MetadataTarget[] = [];

    for (const target of [context.getHandler(), context.getClass()]) {
      // A missing target carries no metadata, so skipping it is safe — and it
      // is required, because `Reflector` throws on `undefined`.
      if (isMetadataTarget(target)) {
        targets.push(target);
      }
    }

    if (targets.length === 0) {
      return false;
    }

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
