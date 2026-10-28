/**
 * Dev/staging self-check of the server's own output (AIS-98, plan §8.4 job 4).
 *
 * The client validates its *input*; this validates the server's *output* against
 * the very schema the client will parse with. A mapper that forgets a field, a
 * controller that returns a bare object instead of `responses.ok()`, or a
 * `null` where the contract says `[]` fails here — in dev, before the browser
 * sees it — instead of surviving until someone notices a blank cell in the admin
 * UI.
 *
 * Scope rules:
 *
 * - only routes that exist in the shared registry are checked; an exempt route
 *   (`/healthz`, VAPI webhooks), a plugin-served asset (`/api/docs`) or a 404 is
 *   passed through untouched;
 * - registered **only** where `isResponseAssertEnabled()` says so — never in
 *   prod, where the extra parse and the deliberate `500` are not acceptable.
 */

import { Injectable } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';
import type { HttpRequestLike } from '../http/request-context.interface.js';
import { assertResponseMatchesContract } from './response-assert.logic.js';
import { findEndpointByRoute } from './route-match.logic.js';

@Injectable()
export class ResponseAssertInterceptor implements NestInterceptor {
  /**
   * @param context - the executing HTTP context.
   * @param next - the handler continuation.
   * @returns the handler's body, after it was validated.
   */
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    const entry = findEndpointByRoute(
      request.method,
      request.routeOptions?.url,
    );

    if (entry === undefined) {
      return next.handle();
    }

    return next.handle().pipe(
      map((body: unknown) => {
        assertResponseMatchesContract(entry, body);

        return body;
      }),
    );
  }
}
