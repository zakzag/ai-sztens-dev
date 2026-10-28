/**
 * `ExecutionContext` doubles for the decorator specs.
 *
 * The `@ReqCtx()` decorator exists to map a Nest execution context onto a
 * {@link RequestContext}; its spec therefore needs the smallest context object
 * that can answer `switchToHttp().getRequest()`. Living here (not inside a spec
 * file) follows the project rule that mocks are reusable artefacts.
 */

import type { ExecutionContext } from '@nestjs/common';
import type { HttpRequestLike } from '../../request-context.interface.js';

/** Request facts the decorator specs assert on. */
export const CONTEXT_REQUEST_FIXTURE: HttpRequestLike = {
  id: 'req-1',
  method: 'POST',
  url: '/api/api-keys',
  headers: {},
};

/**
 * @param request - request the context must hand to the decorator.
 * @returns an `ExecutionContext` double whose HTTP branch yields `request`.
 */
export function createExecutionContext(
  request: HttpRequestLike = CONTEXT_REQUEST_FIXTURE,
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
