/**
 * Deliberately broken controllers for the audit self-test (AIS-97, DoD 3).
 *
 * The gate is only worth having if it fails when it should, so these fixtures are
 * the negative cases, kept permanently instead of being "created and deleted"
 * around a manual run:
 *
 * - {@link BareBodyProbeController} — returns a bare object without
 *   `@SkipEnvelope()` and without a registry entry: the exact mistake the gate
 *   exists for;
 * - {@link UnlistedExemptController} — decorated as exempt but missing from
 *   `ENVELOPE_EXEMPTIONS`, i.e. a raw body nobody wrote down.
 *
 * Neither is imported by `AppModule`; they are mounted by nothing.
 */

import { Controller, Get } from '@nestjs/common';
import { SkipEnvelope } from '../../src/common/http/skip-envelope.decorator.js';

/** A non-exempt route that answers with a bare body. */
@Controller('probe-bare')
export class BareBodyProbeController {
  @Get()
  public get(): { readonly ok: boolean } {
    return { ok: true };
  }
}

/** An exempt route that is not on the allow-list. */
@SkipEnvelope()
@Controller('probe-exempt-unlisted')
export class UnlistedExemptController {
  @Get()
  public get(): string {
    return 'raw';
  }
}
