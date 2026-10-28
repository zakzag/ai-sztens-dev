/**
 * Marks a route (or a whole controller) as **exempt** from the envelope.
 *
 * The exemption is not “forgotten wrapping”: the filter reads this metadata and
 * reproduces Nest's default error body byte-for-byte, so an exempt consumer
 * (Docker healthcheck, monitor watchdog, VAPI) keeps its contract. The written
 * list of exemptions lives next to the registry
 * (`ENVELOPE_EXEMPTIONS` in `@callback/shared`).
 *
 * Usage:
 *
 * ```ts
 * @SkipEnvelope()
 * @Controller('healthz')
 * export class HealthController {}
 * ```
 */

import { SetMetadata } from '@nestjs/common';
import { SKIP_ENVELOPE_KEY } from './skip-envelope.const.js';

/**
 * @returns a class/method decorator that opts the route out of the envelope.
 */
export const SkipEnvelope = (): ClassDecorator & MethodDecorator =>
  SetMetadata(SKIP_ENVELOPE_KEY, true);
