import 'reflect-metadata';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { API_ENDPOINTS, ENVELOPE_EXEMPTIONS } from '@callback/shared';
import {
  findUnregisteredRoutes,
  sortUnique,
  toRouteTable,
} from '../src/common/http/test/support/envelope-route.js';
import { loadAppModuleOrSkip } from './lib/app-module-gate.js';

/**
 * The `@SkipEnvelope()` ⇄ `ENVELOPE_EXEMPTIONS` contract over the **real**
 * module graph (AIS-92, plan `D9`).
 *
 * `apps/api/src/common/http/envelope-exemptions.spec.ts` proves the agreement
 * for a hand-written controller inventory and runs everywhere. This suite
 * removes the hand-written part: it asks Nest which controllers the booted
 * `AppModule` actually contains, so a newly added route (or a forgotten
 * `@SkipEnvelope()`) shows up as a failing assertion instead of a production
 * surprise. It self-skips on Node < 24.9, like every other `AppModule` e2e.
 *
 * The route classification lives in the shared test helper, so this suite and
 * the unit twin apply literally the same rules.
 */

/** Enveloped routes deliberately absent from the versioned registry (root probe). */
const UNDOCUMENTED_ENVELOPED_ROUTES: readonly string[] = ['/api'];

describe('Envelope exemptions (e2e)', () => {
  it('keeps `@SkipEnvelope()` and ENVELOPE_EXEMPTIONS in exact two-way agreement', async () => {
    const AppModule = await loadAppModuleOrSkip();
    if (AppModule === null) return; // runtime limitation, warning already logged

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();

    try {
      const discovery = moduleRef.get(DiscoveryService);
      const routes = toRouteTable(
        discovery.getControllers().map((wrapper) => wrapper.metatype),
      );

      // Exact equality of the two sorted lists is the two-way check: a missing
      // decorator and an orphaned registry entry each break it.
      expect(routes.exempt).toEqual(
        sortUnique(ENVELOPE_EXEMPTIONS.map((entry) => entry.path)),
      );
      // The other half of the coverage rule: no enveloped route may be missing
      // from the registry without an explicit, written exception.
      expect(
        findUnregisteredRoutes(
          routes,
          API_ENDPOINTS.map((entry) => entry.path),
          UNDOCUMENTED_ENVELOPED_ROUTES,
        ),
      ).toEqual([]);
      // Guards against a discovery failure making the comparison trivially pass.
      expect(routes.enveloped.length).toBeGreaterThan(0);
    } finally {
      await moduleRef.close();
    }
  });
});
