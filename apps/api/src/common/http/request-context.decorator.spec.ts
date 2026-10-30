import { ReqCtx, resolveRequestContext } from './request-context.decorator.js';
import { createExecutionContext } from './test/mocks/execution-context.mock.js';

/**
 * `@ReqCtx()` is what guarantees `meta.requestId` exists on every enveloped
 * response, so the mapping from a Nest execution context to a
 * `RequestContext` is asserted directly; the decorator itself is only a
 * one-line wrapper around it.
 */
describe('resolveRequestContext', () => {
  it('maps the HTTP request onto the correlation context', () => {
    const context = resolveRequestContext(createExecutionContext());

    expect(context.requestId).toBe('req-1');
    expect(context.path).toBe('/api/api-keys');
    expect(context.method).toBe('POST');
    expect(Number.isNaN(Date.parse(context.timestamp))).toBe(false);
  });

  it('preserves a valid inbound X-Request-Id', () => {
    const context = resolveRequestContext(
      createExecutionContext({
        id: 'req-1',
        method: 'GET',
        url: '/api/api-keys',
        headers: { 'x-request-id': 'inbound-trace-1' },
      }),
    );

    expect(context.requestId).toBe('inbound-trace-1');
  });

  it('ignores an invalid inbound X-Request-Id and keeps the Fastify id', () => {
    const context = resolveRequestContext(
      createExecutionContext({
        id: 'req-1',
        method: 'GET',
        url: '/api/api-keys',
        headers: { 'x-request-id': 'bad value\nInjected: 1' },
      }),
    );

    expect(context.requestId).toBe('req-1');
  });
});

describe('ReqCtx', () => {
  it('is a parameter decorator factory', () => {
    expect(typeof ReqCtx).toBe('function');
    expect(typeof ReqCtx()).toBe('function');
  });
});
