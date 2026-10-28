import type { HttpRequestLike } from './request-context.interface.js';
import {
  readRequestId,
  resolveRequestId,
  toRequestContext,
} from './request-context.js';

/**
 * Correlation is what makes a sanitised `500` debuggable, so every branch of the
 * resolver (inbound header, Fastify id, generated fallback) is asserted here.
 */
describe('readRequestId', () => {
  it('returns the inbound header', () => {
    expect(readRequestId({ 'x-request-id': 'abc' })).toBe('abc');
  });

  it('returns the first value of a repeated header', () => {
    expect(readRequestId({ 'x-request-id': ['first', 'second'] })).toBe(
      'first',
    );
  });

  it('ignores a blank header', () => {
    expect(readRequestId({ 'x-request-id': '   ' })).toBeUndefined();
  });

  it('returns undefined when the header is absent', () => {
    expect(readRequestId({})).toBeUndefined();
  });
});

describe('resolveRequestId', () => {
  it('prefers the inbound header over Fastify’s id', () => {
    expect(
      resolveRequestId({
        id: 'fastify-id',
        headers: { 'x-request-id': 'inbound' },
      }),
    ).toBe('inbound');
  });

  it('falls back to the Fastify id', () => {
    expect(resolveRequestId({ id: 'fastify-id', headers: {} })).toBe(
      'fastify-id',
    );
  });

  it('generates an id when neither source exists', () => {
    const request: HttpRequestLike = { headers: {} };

    expect(resolveRequestId(request).length).toBeGreaterThan(0);
  });
});

describe('toRequestContext', () => {
  it('builds requestId, timestamp, path and method', () => {
    const context = toRequestContext(
      {
        id: 'req-1',
        method: 'GET',
        url: '/api/api-keys?limit=1',
        headers: {},
      },
      new Date('2026-10-27T10:00:00.000Z'),
    );

    expect(context).toEqual({
      requestId: 'req-1',
      timestamp: '2026-10-27T10:00:00.000Z',
      path: '/api/api-keys?limit=1',
      method: 'GET',
    });
  });

  it('uses safe defaults when the request is incomplete', () => {
    const context = toRequestContext({ headers: {} });

    expect(context.path).toBe('/');
    expect(context.method).toBe('GET');
  });
});
