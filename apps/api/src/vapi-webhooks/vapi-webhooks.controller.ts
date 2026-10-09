import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { VapiSignatureGuard } from './vapi-signature.guard.js';
import { VapiWebhooksService } from './vapi-webhooks.service.js';
import type {
  VapiEndOfCallReportEvent,
  VapiToolCallsEvent,
} from './dto/vapi-event.dto.js';

/**
 * Inbound VAPI webhook endpoints.
 *
 * Every route under this controller is mounted behind
 * `VapiSignatureGuard`, which verifies the HMAC over the raw body
 * (see the guard's docblock for the exact wire contract). The Caddy
 * layer (`infra/caddy/Caddyfile`) additionally rejects anything that
 * is not POST + has an `X-Vapi-Signature` header with a 405 BEFORE
 * the request even reaches NestJS — this is the cheap, header-only
 * pre-filter; the guard is the real authentication.
 *
 * Both endpoints currently share the same shape (record + 200). The
 * real business logic (tool execution, status updates, follow-up
 * actions) will be added on top of `VapiWebhooksService` in the next
 * milestone once the VAPI payload contract is finalised.
 */
@Controller('vapi/webhooks')
@UseGuards(VapiSignatureGuard)
export class VapiWebhooksController {
  private readonly logger = new Logger(VapiWebhooksController.name);

  constructor(private readonly vapiWebhooks: VapiWebhooksService) {}

  /**
   * `POST /api/vapi/webhooks/tool-calls`
   *
   * VAPI dispatches a tool-call request here when the assistant needs
   * to invoke a server-side function (e.g. look up availability).
   */
  @Post('tool-calls')
  @HttpCode(HttpStatus.OK)
  onToolCalls(@Body() event: VapiToolCallsEvent): {
    received: true;
    id: string;
  } {
    const stored = this.vapiWebhooks.record('tool-calls', event);
    return { received: true, id: stored.id };
  }

  /**
   * `POST /api/vapi/webhooks/end-of-call-report`
   *
   * VAPI delivers the post-call summary here after the assistant hangs
   * up. This is where the real follow-up flow (owner notification,
   * CRM update, calendar proposal) will eventually hook in.
   */
  @Post('end-of-call-report')
  @HttpCode(HttpStatus.OK)
  onEndOfCallReport(@Body() event: VapiEndOfCallReportEvent): {
    received: true;
    id: string;
  } {
    const stored = this.vapiWebhooks.record('end-of-call-report', event);
    return { received: true, id: stored.id };
  }
}
