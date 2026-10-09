import type { FactoryProvider } from '@nestjs/common';

/**
 * Injection token for the VAPI webhook configuration.
 *
 * A symbol token (instead of injecting `ConfigService`) keeps this bounded
 * context free of the `@nestjs/config` package. Two reasons:
 *
 *   1. Dependency inversion — the guard only needs two values, so it depends
 *      on this narrow interface rather than on the whole config service. That
 *      makes it trivially unit-testable (no DI container, no `.env` files).
 *   2. `@nestjs/config@4` ships CommonJS only and `require()`s the ESM-only
 *      `@nestjs/common@12`. Jest's ESM runner refuses that `require(esm)` on
 *      Node < 24.9, so any test that transitively loads `@nestjs/config`
 *      cannot even start (`Must use import to load ES Module`). Keeping the
 *      webhook surface config-package-free keeps its tests runnable.
 *
 * The production binding lives in `vapi-webhooks.module.ts`
 * (`vapiWebhookConfigProvider`), which reads the values from `process.env`
 * *after* `ConfigModule.forRoot()` has loaded the per-env file
 * (`apps/api/.env.<APP_ENV>`), so the resolved value is exactly the one
 * `ConfigService.get('VAPI_WEBHOOK_SECRET')` would have returned.
 */
export const VAPI_WEBHOOK_CONFIG = Symbol('VAPI_WEBHOOK_CONFIG');

/**
 * The two settings the webhook guard needs.
 *
 * Both are optional on purpose: the guard fails closed (HTTP 500) when the
 * secret is missing, and falls back to its built-in default window when the
 * tolerance is missing or invalid.
 */
export interface VapiWebhookConfig {
  /** HMAC-SHA256 key. `undefined`/empty ⇒ "not configured" ⇒ fail closed. */
  readonly secret?: string;
  /** Freshness window in seconds; `undefined` ⇒ guard default (300s). */
  readonly toleranceSeconds?: number;
}

/**
 * Pure reader for the webhook settings.
 *
 * Takes the environment as an argument (defaulting to `process.env`) so it can
 * be unit-tested without touching global state.
 */
export function readVapiWebhookConfig(
  env: NodeJS.ProcessEnv = process.env,
): VapiWebhookConfig {
  const rawTolerance = env.VAPI_WEBHOOK_TIMESTAMP_TOLERANCE_SEC;
  const parsedTolerance =
    rawTolerance === undefined ? NaN : Number(rawTolerance);

  return {
    secret: env.VAPI_WEBHOOK_SECRET || undefined,
    toleranceSeconds: Number.isFinite(parsedTolerance)
      ? parsedTolerance
      : undefined,
  };
}

/**
 * Nest provider that binds the environment-derived settings to the token.
 *
 * `ConfigModule.forRoot()` (see `app.module.ts`) loads the per-env file into
 * `process.env` synchronously at import time, i.e. before Nest instantiates
 * this provider, so reading `process.env` here is equivalent to injecting
 * `ConfigService` — minus the per-request lookup.
 */
export const vapiWebhookConfigProvider: FactoryProvider<VapiWebhookConfig> = {
  provide: VAPI_WEBHOOK_CONFIG,
  useFactory: (): VapiWebhookConfig => readVapiWebhookConfig(),
};
