/**
 * Test-only controllers for the envelope e2e suite (AIS-97, key decision 4).
 *
 * They exist to exercise branches the real API cannot produce on demand without
 * a database or an artificial failure:
 *
 * - `GET /api/probe/envelope` — a well-formed success through the **real**
 *   `ApiResponseService` and the real filter chain;
 * - `GET /api/probe/empty` — the “empty collection” rule (`[]`, never `null`);
 * - `GET /api/probe/boom` — an unexpected throwable, used to prove that a 500
 *   body is sanitised while the original text survives only in the log.
 *
 * The module is imported **only** by `envelope.e2e-spec.ts`; it never reaches
 * `AppModule`, so these routes cannot ship.
 */

import { Controller, Get, Module } from '@nestjs/common';
import type { ApiEnvelope } from '@callback/shared';
import { ApiResponseService } from '../../src/common/http/api-response.service.js';
import { ReqCtx } from '../../src/common/http/request-context.decorator.js';
import type { RequestContext } from '../../src/common/http/request-context.interface.js';

/** Text the probe throws; the suite asserts it never reaches the client. */
export const PROBE_FAILURE_TEXT =
  'boom: select * from platform.api_keys where api_key = sk-live-secret';

@Controller('probe')
export class EnvelopeProbeController {
  constructor(private readonly responses: ApiResponseService) {}

  /** A well-formed enveloped success. */
  @Get('envelope')
  public envelope(
    @ReqCtx() ctx: RequestContext,
  ): ApiEnvelope<{ probe: string }> {
    return this.responses.ok({ probe: 'ok' }, ctx);
  }

  /** The empty-collection rule: `data: []`, never `null`. */
  @Get('empty')
  public empty(@ReqCtx() ctx: RequestContext): ApiEnvelope<readonly string[]> {
    return this.responses.ok([], ctx);
  }

  /** An unexpected failure, to be sanitised by the global filter. */
  @Get('boom')
  public boom(): never {
    throw new Error(PROBE_FAILURE_TEXT);
  }
}

/** Module wrapper so the spec can mount the probes next to `AppModule`. */
@Module({ controllers: [EnvelopeProbeController] })
export class EnvelopeProbeModule {}
