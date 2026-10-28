/**
 * Test doubles of the OpenAPI layer specs (AIS-98).
 *
 * The interceptor only needs two things from Nest: an execution context that can
 * hand over the request (with Fastify's matched-route pattern) and a
 * `CallHandler` that yields a body. Both are structural shapes, so they live
 * here instead of inside the spec files — the coding standard forbids mocks in
 * tests, and a second spec must be able to reuse them.
 */

import { of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { findEndpoint } from '@callback/shared';
import type {
  ApiEndpointContract,
  ApiEnvelope,
  ApiKey,
} from '@callback/shared';
import { VALID_API_KEY } from '@callback/shared';
import type { HttpRequestLike } from '../../../http/request-context.interface.js';

/** `meta` of every fixture envelope (fixed, so assertions stay exact). */
export const FIXTURE_META = {
  requestId: '0192f3c4-0000-7000-8000-000000000000',
  timestamp: '2026-10-26T15:21:48.752Z',
} as const;

/** A fully valid `GET /api/api-keys` body. */
export const VALID_LIST_ENVELOPE: ApiEnvelope<readonly ApiKey[]> = {
  data: [VALID_API_KEY],
  meta: FIXTURE_META,
};

/**
 * @param operationId - registry id to fetch.
 * @returns the registry entry.
 * @throws Error when the id is not registered (a broken expectation, not a case).
 */
export function entryOrThrow(operationId: string): ApiEndpointContract {
  const entry = findEndpoint(operationId);

  if (entry === undefined) {
    throw new Error(`registry entry "${operationId}" is missing`);
  }

  return entry;
}

/** A request that was matched to `GET /api/api-keys`. */
export const ROUTED_REQUEST: HttpRequestLike = {
  id: 'req-openapi-1',
  method: 'GET',
  url: '/api/api-keys',
  headers: {},
  routeOptions: { url: '/api/api-keys' },
};

/**
 * @param request - request the context must expose.
 * @returns an `ExecutionContext` double whose HTTP branch yields `request`.
 */
export function createOpenApiExecutionContext(
  request: HttpRequestLike = ROUTED_REQUEST,
): ExecutionContext {
  const http = {
    getRequest: () => request,
    getResponse: () => ({}),
    getNext: () => undefined,
  };

  return {
    getType: () => 'http',
    switchToHttp: () => http,
    getClass: () => undefined,
    getHandler: () => undefined,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => {
      throw new Error('not used in this suite');
    },
    switchToWs: () => {
      throw new Error('not used in this suite');
    },
  } as unknown as ExecutionContext;
}

/**
 * @param body - the body the handler "produced".
 * @returns a `CallHandler` that emits exactly that body once.
 */
export function createCallHandler(body: unknown): CallHandler {
  return { handle: () => of(body) };
}
