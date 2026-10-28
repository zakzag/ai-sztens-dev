import { REQUEST_ID_MAX_LENGTH } from './request-id.const.js';
import type { HttpRequestLike } from './request-context.interface.js';
import {
  isValidRequestId,
  readRequestId,
  resolveRequestId,
  toRequestContext,
} from './request-context.js';

/**
 * Correlation is what makes a sanitised `500` debuggable, so every branch of the
 * resolver (inbound header, Fastify id, generated fallback) is asserted here —
 * including the rejection branch, because the inbound header is
 * attacker-controlled and ends up in a response header and in every log line.
 */
describe('isValidRequestId', () => {
  it('accepts a UUID, an underscore/colon/dash value', () => {
    expect(isValidRequestId('0192f3c4-3f8a-7d1e-9b6c-2a4e5f607182')).toBe(true);
    expect(isValidRequestId('trace_id:1-a.b')).toBe(true);
  });

  it('rejects an empty value', () => {
    expect(isValidRequestId('')).toBe(false);
  });

  it('rejects a value above the length limit', () => {
    expect(isValidRequestId('a'.repeat(REQUEST_ID_MAX_LENGTH + 1))).toBe(false);
  });

  it('accepts a value exactly on the length limit', () => {
    expect(isValidRequestId('a'.repeat(REQUEST_ID_MAX_LENGTH))).toBe(true);
  });

  it('rejects whitespace, newline and other control characters', () => {
    expect(isValidRequestId('bad value')).toBe(false);
    expect(isValidRequestId('bad\nvalue')).toBe(false);
    expect(isValidRequestId('<script>')).toBe(false);
  });

  it('rejects a non-string candidate', () => {
    expect(isValidRequestId(undefined)).toBe(false);
    expect(isValidRequestId(42)).toBe(false);
  });
});

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

  it('ignores a header above the length limit', () => {
    expect(
      readRequestId({ 'x-request-id': 'a'.repeat(REQUEST_ID_MAX_LENGTH + 1) }),
    ).toBeUndefined();
  });

  it('ignores a header with a forbidden character', () => {
    expect(readRequestId({ 'x-request-id': 'abc def' })).toBeUndefined();
    expect(readRequestId({ 'x-request-id': 'abc\r\nX-Injected: 1' })).toBe(
      undefined,
    );
  });

  it('ignores a repeated header whose first value is invalid', () => {
    expect(
      readRequestId({ 'x-request-id': ['bad value', 'good-value'] }),
    ).toBeUndefined();
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

  it('falls back to the Fastify id when the inbound id is invalid', () => {
    expect(
      resolveRequestId({
        id: 'fastify-id',
        headers: { 'x-request-id': 'not a valid id' },
      }),
    ).toBe('fastify-id');
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
