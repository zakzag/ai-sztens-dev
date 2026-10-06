import {
  VAPI_WEBHOOK_CONFIG,
  readVapiWebhookConfig,
  vapiWebhookConfigProvider,
} from './vapi-webhook-config.js';

/**
 * Unit tests for the pure env reader and the provider that binds it.
 *
 * The reader takes the environment as an argument, so nothing here touches
 * global state (except the provider test, which restores `process.env`
 * afterwards).
 */

describe('readVapiWebhookConfig', () => {
  it('reads the secret and a numeric tolerance', () => {
    expect(
      readVapiWebhookConfig({
        VAPI_WEBHOOK_SECRET: 'secret-value',
        VAPI_WEBHOOK_TIMESTAMP_TOLERANCE_SEC: '60',
      }),
    ).toEqual({ secret: 'secret-value', toleranceSeconds: 60 });
  });

  it('reports the secret as undefined when it is missing or empty', () => {
    expect(readVapiWebhookConfig({})).toEqual({
      secret: undefined,
      toleranceSeconds: undefined,
    });
    expect(
      readVapiWebhookConfig({ VAPI_WEBHOOK_SECRET: '' }).secret,
    ).toBeUndefined();
  });

  it('reports the tolerance as undefined when it is not a number', () => {
    expect(
      readVapiWebhookConfig({
        VAPI_WEBHOOK_SECRET: 's',
        VAPI_WEBHOOK_TIMESTAMP_TOLERANCE_SEC: 'five-minutes',
      }).toleranceSeconds,
    ).toBeUndefined();
  });

  it('passes a negative tolerance through (the guard clamps it to the default)', () => {
    expect(
      readVapiWebhookConfig({
        VAPI_WEBHOOK_SECRET: 's',
        VAPI_WEBHOOK_TIMESTAMP_TOLERANCE_SEC: '-5',
      }).toleranceSeconds,
    ).toBe(-5);
  });
});

describe('vapiWebhookConfigProvider', () => {
  const ORIGINAL = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('is bound to the VAPI_WEBHOOK_CONFIG token', () => {
    expect(vapiWebhookConfigProvider.provide).toBe(VAPI_WEBHOOK_CONFIG);
  });

  it('reads the current process environment through the factory', () => {
    process.env.VAPI_WEBHOOK_SECRET = 'from-process-env';
    process.env.VAPI_WEBHOOK_TIMESTAMP_TOLERANCE_SEC = '42';

    expect(vapiWebhookConfigProvider.useFactory()).toEqual({
      secret: 'from-process-env',
      toleranceSeconds: 42,
    });
  });
});
