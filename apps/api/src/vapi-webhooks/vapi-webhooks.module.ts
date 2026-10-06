import { Module } from '@nestjs/common';
import { VapiWebhooksController } from './vapi-webhooks.controller.js';
import { VapiWebhooksService } from './vapi-webhooks.service.js';
import { VapiSignatureGuard } from './vapi-signature.guard.js';
import { vapiWebhookConfigProvider } from './vapi-webhook-config.js';

/**
 * VAPI inbound webhook module.
 *
 * Mounts `POST /api/vapi/webhooks/tool-calls` and
 * `POST /api/vapi/webhooks/end-of-call-report` behind the
 * `VapiSignatureGuard`. The actual webhook surface (record-only
 * vertical slice) lives in `VapiWebhooksService` and is exported for
 * future modules to consume (e.g. an "owner notification" worker).
 *
 * The Caddy layer (`infra/caddy/Caddyfile`, `handle @vapi_match`) is the
 * FIRST line of defence: anything that is not POST + lacks
 * `X-Vapi-Signature` is dropped with a 405 before it reaches the
 * NestJS process. This module is the SECOND line of defence: the
 * HMAC over the raw body is verified here.
 *
 * `vapiWebhookConfigProvider` binds the `VAPI_WEBHOOK_CONFIG` symbol token to
 * the env-derived settings (`VAPI_WEBHOOK_SECRET`,
 * `VAPI_WEBHOOK_TIMESTAMP_TOLERANCE_SEC`). Registering it here — instead of
 * injecting `ConfigService` — keeps this module loadable without the
 * (CommonJS-only) `@nestjs/config` package, which is what makes the module's
 * own spec and the webhook e2e suite runnable in Jest's ESM mode.
 */
@Module({
  controllers: [VapiWebhooksController],
  providers: [
    VapiWebhooksService,
    VapiSignatureGuard,
    vapiWebhookConfigProvider,
  ],
  exports: [VapiWebhooksService],
})
export class VapiWebhooksModule {}
