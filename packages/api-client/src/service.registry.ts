/**
 * Composition root of the registry ⇄ service coverage gate (AIS-110).
 *
 * One line per resource: the key must equal the `operationId` namespace, because
 * `findCoverageGaps` derives the namespace from the registry and looks the
 * factory up by it. A missing line therefore fails `service-coverage.test.ts`
 * with the exact operation ids that cannot be called.
 *
 * A single module on purpose: the map is the only place that knows which
 * services exist, so the gate never has to be edited when a resource is added —
 * only this file is.
 */

import { createApiKeysService } from './api-keys/api-keys.service.js';
import type { ServiceFactories } from './service-coverage.interface.js';

/**
 * @returns the factory of every resource service, keyed by registry namespace.
 */
export function createServiceFactories(): ServiceFactories {
  return {
    apiKeys: createApiKeysService,
  };
}
