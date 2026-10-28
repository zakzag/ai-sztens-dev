import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { SKIP_ENVELOPE_KEY } from './skip-envelope.const.js';
import { SkipEnvelope } from './skip-envelope.decorator.js';

/**
 * The exemption is read by `ApiExceptionFilter` through `Reflector`, so the
 * metadata has to be attached where the filter looks: the handler function
 * first, then the controller class. A silent break here would start wrapping
 * `healthz` / VAPI bodies, which their consumers cannot parse.
 *
 * The fixture methods declare `this: void` because the specs reference them
 * detached from their object — that is exactly what `Reflector` does.
 */

@SkipEnvelope()
class ExemptController {
  check(this: void): void {
    // body irrelevant: only the class metadata matters
  }
}

class MixedController {
  @SkipEnvelope()
  exempt(this: void): void {
    // decorated route
  }

  regular(this: void): void {
    // decorated nowhere
  }
}

describe('SkipEnvelope', () => {
  const reflector = new Reflector();

  it('uses the documented, stable metadata key', () => {
    expect(SKIP_ENVELOPE_KEY).toBe('callback:skip-envelope');
  });

  it('flags a decorated controller class', () => {
    expect(
      reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
        ExemptController,
      ]),
    ).toBe(true);
  });

  it('flags a decorated handler', () => {
    expect(
      reflector.get<boolean>(
        SKIP_ENVELOPE_KEY,
        MixedController.prototype.exempt,
      ),
    ).toBe(true);
  });

  it('leaves an undecorated handler undefined, which the filter reads as enveloped', () => {
    expect(
      reflector.get<boolean>(
        SKIP_ENVELOPE_KEY,
        MixedController.prototype.regular,
      ),
    ).toBeUndefined();
  });

  it('resolves the flag from whichever target carries it', () => {
    expect(
      reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
        MixedController.prototype.regular,
        ExemptController,
      ]),
    ).toBe(true);
  });
});
