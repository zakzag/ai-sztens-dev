import { Test } from '@nestjs/testing';
import { VAPI_WEBHOOK_CONFIG } from './vapi-webhook-config.js';
import { VapiSignatureGuard } from './vapi-signature.guard.js';
import { VapiWebhooksController } from './vapi-webhooks.controller.js';
import { VapiWebhooksModule } from './vapi-webhooks.module.js';
import { VapiWebhooksService } from './vapi-webhooks.service.js';

/**
 * DI wiring regression test for the VAPI webhook module.
 *
 * Why this file exists: the first version of the guard injected
 * `ConfigService` through a type-only import (`import type { ConfigService }`),
 * which erased the runtime reference and made `emitDecoratorMetadata` write
 * `design:paramtypes = [Function]`. Nest then failed to resolve the guard and
 * the **whole application** refused to boot with
 * `UnknownDependenciesException`, while every unit test still passed because
 * they constructed the guard by hand.
 *
 * Compiling the real module (with only the config token overridden) is the
 * cheapest test that executes the same dependency-resolution path as
 * production. It intentionally does not import `@nestjs/config`, so it stays
 * runnable under Jest's ESM runner.
 */

describe('VapiWebhooksModule', () => {
  it('resolves the guard, the controller and the config token from the real module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [VapiWebhooksModule],
    })
      .overrideProvider(VAPI_WEBHOOK_CONFIG)
      .useValue({ secret: 'module-spec-secret' })
      .compile();

    expect(moduleRef.get(VapiSignatureGuard)).toBeInstanceOf(
      VapiSignatureGuard,
    );
    expect(moduleRef.get(VapiWebhooksController)).toBeInstanceOf(
      VapiWebhooksController,
    );
    expect(moduleRef.get(VapiWebhooksService)).toBeInstanceOf(
      VapiWebhooksService,
    );
    expect(moduleRef.get(VAPI_WEBHOOK_CONFIG)).toEqual({
      secret: 'module-spec-secret',
    });

    await moduleRef.close();
  });

  it('provides the config token from the environment when it is not overridden', async () => {
    process.env.VAPI_WEBHOOK_SECRET = 'module-spec-env-secret';
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [VapiWebhooksModule],
      }).compile();

      expect(moduleRef.get(VAPI_WEBHOOK_CONFIG)).toEqual({
        secret: 'module-spec-env-secret',
        toleranceSeconds: undefined,
      });

      await moduleRef.close();
    } finally {
      delete process.env.VAPI_WEBHOOK_SECRET;
    }
  });
});
