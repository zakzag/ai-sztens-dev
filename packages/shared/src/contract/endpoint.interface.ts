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
import type { ApiErrorCode } from './error-code.const.js';

/** HTTP methods the registry can describe. */
export type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * One documented **query-string** parameter (AIS-107).
 *
 * `schema` is a JSON-Schema fragment, not a zod schema, because the runtime
 * validation schema of a list query ends in a `transform` and cannot be
 * rendered as a parameter. The fragments are built from the same constants the
 * validation uses (see `list-query.parameters.ts`), so the document and the
 * `400` cannot disagree about a bound.
 */
export interface ApiQueryParameterContract {
  /** Query parameter name, e.g. `limit`. */
  readonly name: string;

  /** One sentence shown in Swagger UI. */
  readonly description: string;

  /** `true` only for a parameter the request cannot omit. */
  readonly required: boolean;

  /** JSON-Schema fragment (`type`, `enum`, bounds, `default`). */
  readonly schema: Readonly<Record<string, unknown>>;
}

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
  /** OpenAPI tag; groups the operation per resource (`api-keys`). */
  readonly tag: string;
  /** Status of a successful call (`200` read, `201` create). */
  readonly successStatus: number;
  /** Schema of the payload (`data` when enveloped, the whole body when not). */
  readonly dataSchema: z.ZodTypeAny;
  /**
   * Sample payload, published as the OpenAPI `example` of the success response.
   *
   * Optional, and typed `unknown` on purpose: the value is opaque to the
   * registry (the document generator publishes it verbatim) and the compiler
   * must not pretend it can prove the sample matches `dataSchema`. The shared
   * registry test proves that instead, by parsing it.
   */
  readonly example?: unknown;
  /** Schema of the request body; absent for bodyless endpoints. */
  readonly requestSchema?: z.ZodTypeAny;

  /**
   * Query-string parameters the endpoint accepts, in publication order.
   *
   * Absent for endpoints that take none. Documented from
   * {@link ApiQueryParameterContract} descriptors — never generated from the
   * validation schema, see that type's docblock.
   */
  readonly queryParameters?: readonly ApiQueryParameterContract[];

  /**
   * `meta.pagination` of the published example.
   *
   * Only meaningful together with `envelope: true` on a paginated list: without
   * it the sample body would show a paged endpoint as if it had no paging
   * block.
   */
  readonly examplePagination?: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
  /**
   * Error codes the endpoint can answer with, taken **from the catalogue**
   * (`API_ERROR_CODE`) rather than from free text, so the generated spec and
   * the client mapping can never disagree about a code.
   */
  readonly errors: readonly ApiErrorCode[];
  /** `false` only for the documented exemptions (`/healthz`, VAPI webhooks). */
  readonly envelope: boolean;
}
