/**
 * Test doubles of the HTTP edge specs.
 *
 * The exception filter is the security-relevant part of the envelope (it is the
 * only place where a throwable becomes a response), so its specs need a reply,
 * a request and a `Reflector` they fully control. They live here — not inside a
 * spec file — because the coding standard forbids mocks in test files and a
 * second spec (e.g. a future interceptor) must reuse the same shapes.
 *
 * The request/reply shapes are structural on purpose: `HttpRequestLike` and
 * `HttpReplyLike` are declared by the production code without importing Fastify
 * types, so a Fastify upgrade cannot silently invalidate these doubles.
 */

import { jest } from '@jest/globals';
import type { ArgumentsHost } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { SKIP_ENVELOPE_KEY } from '../../skip-envelope.const.js';

/** Fastify's reply as the filter sees it, with every method spied on. */
export interface ReplySpy {
  /** Sets a response header and returns the reply (Fastify is chainable). */
  readonly header: jest.Mock<(name: string, value: string) => unknown>;
  /** Sets the status code and returns the reply. */
  readonly status: jest.Mock<(code: number) => unknown>;
  /** Sends the body. */
  readonly send: jest.Mock<(body: unknown) => unknown>;
}

/** Request facts every filter assertion leans on. */
export const REQUEST_FIXTURE = {
  id: 'req-1',
  method: 'GET',
  url: '/api/api-keys',
  headers: {},
} as const;

/**
 * @returns a chainable reply double; `header()`/`status()` return the reply.
 */
export function createReply(): ReplySpy {
  const reply = {
    header: jest.fn<(name: string, value: string) => unknown>(),
    status: jest.fn<(code: number) => unknown>(),
    send: jest.fn<(body: unknown) => unknown>(),
  };

  reply.header.mockReturnValue(reply);
  reply.status.mockReturnValue(reply);

  return reply;
}

/**
 * Which metadata targets the fake host exposes.
 *
 * Nest does not always populate `getHandler()` / `getClass()` on the host it
 * hands to an exception filter (the route-handler path builds one from the raw
 * `[req, res, next]` tuple), so the specs need to reproduce the missing-target
 * case — `Reflector` throws `TypeError` on an `undefined` target.
 */
export type MetadataTargets = 'both' | 'handler' | 'class' | 'none';

/** Options of {@link createHost}. */
export interface HostOptions {
  /** Value `ArgumentsHost#getType()` reports; `'http'` unless overridden. */
  readonly type?: string;
  /** Metadata targets the host exposes; `'both'` unless overridden. */
  readonly metadataTargets?: MetadataTargets;
  /** Concrete request URL; the fixture's `/api/api-keys` unless overridden. */
  readonly requestUrl?: string;
  /** Fastify route pattern (`request.routeOptions.url`), when there is one. */
  readonly routePattern?: string;
}

/**
 * @param reply - reply double the filter must answer on.
 * @param options - overrides for the reported transport type and the exposed
 *   metadata targets.
 * @returns an `ArgumentsHost` double with a handler and a controller class.
 */
export function createHost(
  reply: ReplySpy,
  options: HostOptions = {},
): ArgumentsHost {
  const handler = (): void => undefined;
  class ControllerStub {}

  const targets = options.metadataTargets ?? 'both';
  const exposesHandler = targets === 'both' || targets === 'handler';
  const exposesClass = targets === 'both' || targets === 'class';

  const request = {
    ...REQUEST_FIXTURE,
    url: options.requestUrl ?? REQUEST_FIXTURE.url,
    routeOptions:
      options.routePattern === undefined
        ? undefined
        : { url: options.routePattern },
  };

  const http = {
    getRequest: () => request,
    getResponse: () => reply,
  };

  return {
    getType: () => options.type ?? 'http',
    switchToHttp: () => http,
    getHandler: () => (exposesHandler ? handler : undefined),
    getClass: () => (exposesClass ? ControllerStub : undefined),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => {
      throw new Error('not used in this suite');
    },
    switchToWs: () => {
      throw new Error('not used in this suite');
    },
  } as unknown as ArgumentsHost;
}

/** A `Reflector` double plus the metadata keys it was asked about. */
export interface ReflectorSpy {
  /** Pass to the provider under test. */
  readonly reflector: Reflector;
  /** Every metadata key the code under test looked up, in call order. */
  readonly requestedKeys: readonly string[];
}

/** Options of {@link createReflectorSpy}. */
export interface ReflectorSpyOptions {
  /** Whether the `@SkipEnvelope()` flag is present on the matched targets. */
  readonly exempt: boolean;
}

/**
 * Answers `getAllAndOverride` only for the `@SkipEnvelope()` key, so a spec can
 * prove the filter reads **that** metadata key and not an arbitrary one.
 *
 * @param options - whether the routes are exempt.
 */
export function createReflectorSpy(options: ReflectorSpyOptions): ReflectorSpy {
  const requestedKeys: string[] = [];

  const reflector = {
    getAllAndOverride: (
      key: string,
      targets: readonly unknown[] = [],
    ): boolean => {
      requestedKeys.push(key);

      // `Reflect.getMetadata` throws on a non-object target; emulating that is
      // what lets a spec prove the filter never forwards a missing handler or
      // class (which would turn every 4xx into a 500).
      if (targets.some((target) => target === undefined || target === null)) {
        throw new TypeError('Reflect.getMetadata called on non-object');
      }

      return options.exempt && key === SKIP_ENVELOPE_KEY;
    },
  } as unknown as Reflector;

  return { reflector, requestedKeys };
}
