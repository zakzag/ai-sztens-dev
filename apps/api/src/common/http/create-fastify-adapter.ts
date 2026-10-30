/**
 * The one Fastify adapter factory of the API (AIS-92, plan `D10`).
 *
 * `genReqId` is set explicitly to a random UUID instead of leaving Fastify's
 * default in place. The default produces a per-process counter (`req-1`,
 * `req-2`, …), which is **not unique across restarts or container replicas** —
 * that id is what ends up in `meta.requestId`, so two unrelated failures in two
 * containers could share a trace id. A UUID makes a `requestId` globally
 * meaningful, and Fastify's own log lines then carry the same value as the
 * response.
 *
 * `main.ts` and every e2e suite build their adapter here, so the tests exercise
 * the production id-generation contract instead of a default they cannot see.
 */

import { FastifyAdapter } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';

/**
 * @returns a Fastify adapter whose request ids are random UUIDs.
 */
export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    // No parameter: the request object is not needed for a UUID, and depending
    // on it would tie this factory to Fastify's raw-request type.
    genReqId: (): string => randomUUID(),
  });
}
