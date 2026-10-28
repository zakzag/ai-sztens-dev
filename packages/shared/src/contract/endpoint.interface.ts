/**
 * Shape of one entry in the endpoint registry (plan §8, `D6`).
 *
 * The registry is a *derived artefact*, never a second description: it points at
 * the very zod schemas the server validates with and the client parses with, so
 * OpenAPI generation, route-coverage tests and future tooling (Postman, agents)
 * all read the same definition.
 *
 * Two fields need explaining:
 *
 * - `dataSchema` is the schema of the **payload**, not of the whole body. When
 *   `envelope` is `true` the wire body is `{ data, meta }` and the generator
 *   wraps this schema with `envelopeOf()`; when it is `false` the payload *is*
 *   the body (an exempt route, see the plan's `D9`).
 * - `requestSchema` is optional because a `GET` has no body; a `POST` without one
 *   is a contract bug, not a variant.
 */

import type { z } from 'zod';

/** HTTP methods the registry can describe. */
export type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * One documented endpoint.
 *
 * `operationId` is stable and namespaced (`apiKeys.list`) so generated clients
 * and tooling do not churn when a route moves.
 */
export interface ApiEndpointContract {
  /** Stable, namespaced identifier, e.g. `apiKeys.list`. */
  readonly operationId: string;
  /** HTTP verb. */
  readonly method: ApiHttpMethod;
  /** Route as Nest declares it, incl. the global `api` prefix. */
  readonly path: string;
  /** One sentence, used as the OpenAPI `summary`. */
  readonly summary: string;
  /** Status of a successful call (`200` read, `201` create). */
  readonly successStatus: number;
  /** Schema of the payload (`data` when enveloped, the whole body when not). */
  readonly dataSchema: z.ZodTypeAny;
  /** Schema of the request body; absent for bodyless endpoints. */
  readonly requestSchema?: z.ZodTypeAny;
  /** `false` only for the documented exemptions (`/healthz`, VAPI webhooks). */
  readonly envelope: boolean;
}
