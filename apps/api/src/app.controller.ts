import { Controller, Get } from '@nestjs/common';
import type { ApiEnvelope } from '@callback/shared';
import { AppService } from './app.service.js';
import { ApiResponseService } from './common/http/api-response.service.js';
import { ReqCtx } from './common/http/request-context.decorator.js';
import type { RequestContext } from './common/http/request-context.interface.js';

/**
 * Root endpoint, kept as the “is the envelope wired at all?” probe.
 *
 * It used to return a bare string, which made it the only response in the API
 * that did not follow the contract. It now goes through `responses.ok()` like
 * every other route — a bare body outside the `@SkipEnvelope()` allow-list is a
 * contract violation.
 */
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly responses: ApiResponseService,
  ) {}

  @Get()
  getHello(@ReqCtx() ctx: RequestContext): ApiEnvelope<string> {
    return this.responses.ok(this.appService.getHello(), ctx);
  }
}
