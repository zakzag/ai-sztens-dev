/**
 * The request body of one registered endpoint (AIS-109).
 *
 * The registry is the single description of the HTTP contract, so the **body
 * type** of a mutation must come from it too. Before this module a service wrote
 * `body: unknown`, which meant a wrong input only surfaced as a `400` at
 * runtime — after the user had already submitted the form.
 *
 * The type is derived, never re-declared:
 *
 * 1. {@link EndpointOf} picks the registry entry with the requested
 *    `operationId` out of the **literal** registry type (which is why both
 *    registry arrays are `as const satisfies` — see `endpoint.registry.ts`);
 * 2. {@link RequestBodyOf} infers the zod schema stored in `requestSchema` and
 *    returns its output type, i.e. exactly what the service must send.
 *
 * A bodyless endpoint (`GET`, `DELETE`) resolves to `never`, so passing a body
 * to it is a compile error instead of a silently ignored payload.
 */

import type { z } from 'zod';
import type { API_ENDPOINTS } from './endpoint.registry.js';

/** The registry entry whose `operationId` is `TId` (never when unregistered). */
type EndpointOf<TId extends string> = Extract<
  (typeof API_ENDPOINTS)[number],
  { readonly operationId: TId }
>;

/**
 * The request body of the endpoint identified by `TId`.
 *
 * @example
 * ```ts
 * const body: RequestBodyOf<'apiKeys.update'> = { name: 'prod', updatedAt: iso };
 * // a missing `updatedAt` or an unknown field is a compile error
 * ```
 *
 * @typeParam TId - stable registry key, e.g. `apiKeys.update`.
 */
export type RequestBodyOf<TId extends string> =
  EndpointOf<TId> extends {
    readonly requestSchema: infer TSchema extends z.ZodTypeAny;
  }
    ? z.infer<TSchema>
    : never;
