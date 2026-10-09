import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { VapiSignatureGuard } from './vapi-signature.guard.js';
import type { VapiWebhookConfig } from './vapi-webhook-config.js';

/**
 * Unit tests for the VapiSignatureGuard.
 *
 * The guard is constructed directly with a plain `VapiWebhookConfig` object,
 * so the suite stays hermetic: no DI container, no `.env` files, and — since
 * the guard no longer depends on `@nestjs/config` — no CommonJS/ESM interop
 * trap either.
 *
 * The HMAC math uses the same `crypto.createHmac` primitive the guard uses
 * internally, so the positive cases are true round-trips and the negative
 * cases cover the real failure modes (wrong secret, tampered body, stale
 * timestamp, malformed headers, missing raw body, missing secret).
 */

const SECRET = 'test-secret-do-not-use-in-prod';
const RAW_BODY = '{"message":{"id":"evt-1","type":"tool-calls"}}';

function sign(
  secret: string,
  timestamp: string,
  body: string,
  scheme = 'sha256',
): string {
  const hex = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `${scheme}=${hex}`;
}

function makeGuard(config: VapiWebhookConfig = { secret: SECRET }) {
  return new VapiSignatureGuard(config);
}

function makeContext(opts: {
  signatureHeader?: string | string[];
  timestampHeader?: string | string[];
  rawBody?: unknown;
}): ExecutionContext {
  const headers: Record<string, string | string[]> = {};
  if (opts.signatureHeader !== undefined) {
    headers['x-vapi-signature'] = opts.signatureHeader;
  }
  if (opts.timestampHeader !== undefined) {
    headers['x-vapi-timestamp'] = opts.timestampHeader;
  }
  const request = {
    headers,
    rawBody: opts.rawBody,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('VapiSignatureGuard', () => {
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  it('returns true for a correctly signed request', () => {
    const ts = String(nowSeconds());
    const ctx = makeContext({
      signatureHeader: sign(SECRET, ts, RAW_BODY),
      timestampHeader: ts,
      rawBody: RAW_BODY,
    });
    expect(makeGuard().canActivate(ctx)).toBe(true);
  });

  it("accepts the Buffer raw body that Nest's Fastify adapter provides", () => {
    // Nest registers the JSON parser with `parseAs: 'buffer'`, so production
    // hands the guard a Buffer. Regression guard for the version of the guard
    // that only accepted `typeof rawBody === 'string'` and therefore rejected
    // every genuine webhook.
    const ts = String(nowSeconds());
    const ctx = makeContext({
      signatureHeader: sign(SECRET, ts, RAW_BODY),
      timestampHeader: ts,
      rawBody: Buffer.from(RAW_BODY, 'utf8'),
    });
    expect(makeGuard().canActivate(ctx)).toBe(true);
  });

  it('rejects a Buffer whose bytes differ from the signed payload', () => {
    const ts = String(nowSeconds());
    const ctx = makeContext({
      signatureHeader: sign(SECRET, ts, RAW_BODY),
      timestampHeader: ts,
      rawBody: Buffer.from(`${RAW_BODY} `, 'utf8'),
    });
    expect(() => makeGuard().canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('reads the first value when a header arrives as a list', () => {
    const ts = String(nowSeconds());
    const ctx = makeContext({
      signatureHeader: [sign(SECRET, ts, RAW_BODY), 'sha256=ignored'],
      timestampHeader: [ts, String(nowSeconds() - 10_000)],
      rawBody: RAW_BODY,
    });
    expect(makeGuard().canActivate(ctx)).toBe(true);
  });

  it('accepts the explicit sha256=v1= prefix', () => {
    const ts = String(nowSeconds());
    const ctx = makeContext({
      signatureHeader: sign(SECRET, ts, RAW_BODY, 'sha256=v1'),
      timestampHeader: ts,
      rawBody: RAW_BODY,
    });
    expect(makeGuard().canActivate(ctx)).toBe(true);
  });

  it('throws UnauthorizedException for a wrong signature', () => {
    const ts = String(nowSeconds());
    const ctx = makeContext({
      signatureHeader: sign('a-different-secret', ts, RAW_BODY),
      timestampHeader: ts,
      rawBody: RAW_BODY,
    });
    expect(() => makeGuard().canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the body was tampered with', () => {
    const ts = String(nowSeconds());
    const ctx = makeContext({
      signatureHeader: sign(SECRET, ts, RAW_BODY),
      timestampHeader: ts,
      rawBody: RAW_BODY + ' ', // trailing space: invalidates the HMAC
    });
    expect(() => makeGuard().canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a stale timestamp', () => {
    const ts = String(nowSeconds() - 10_000); // way outside the 300s default
    const ctx = makeContext({
      signatureHeader: sign(SECRET, ts, RAW_BODY),
      timestampHeader: ts,
      rawBody: RAW_BODY,
    });
    expect(() => makeGuard().canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('honours the configured tolerance when narrowing the window', () => {
    const ts = String(nowSeconds() - 60); // 60s ago, outside a 30s window
    const ctx = makeContext({
      signatureHeader: sign(SECRET, ts, RAW_BODY),
      timestampHeader: ts,
      rawBody: RAW_BODY,
    });
    expect(() =>
      makeGuard({ secret: SECRET, toleranceSeconds: 30 }).canActivate(ctx),
    ).toThrow(UnauthorizedException);
  });

  it('falls back to the 300s default when the configured tolerance is invalid', () => {
    const ts = String(nowSeconds() - 120); // inside 300s, outside 0s
    const ctx = makeContext({
      signatureHeader: sign(SECRET, ts, RAW_BODY),
      timestampHeader: ts,
      rawBody: RAW_BODY,
    });
    expect(() =>
      makeGuard({ secret: SECRET, toleranceSeconds: 0 }).canActivate(ctx),
    ).not.toThrow();
  });

  it('throws UnauthorizedException when the timestamp header is missing', () => {
    const ctx = makeContext({
      signatureHeader: sign(SECRET, String(nowSeconds()), RAW_BODY),
      timestampHeader: undefined,
      rawBody: RAW_BODY,
    });
    expect(() => makeGuard().canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the signature header is missing', () => {
    const ctx = makeContext({
      signatureHeader: undefined,
      timestampHeader: String(nowSeconds()),
      rawBody: RAW_BODY,
    });
    expect(() => makeGuard().canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the timestamp is not numeric', () => {
    const ctx = makeContext({
      signatureHeader: sign(SECRET, 'not-a-number', RAW_BODY),
      timestampHeader: 'not-a-number',
      rawBody: RAW_BODY,
    });
    expect(() => makeGuard().canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a non-hex signature', () => {
    const ts = String(nowSeconds());
    const ctx = makeContext({
      signatureHeader: 'sha256=zzzz-not-hex',
      timestampHeader: ts,
      rawBody: RAW_BODY,
    });
    expect(() => makeGuard().canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a signature with the wrong length', () => {
    const ts = String(nowSeconds());
    const ctx = makeContext({
      signatureHeader: 'sha256=deadbeef',
      timestampHeader: ts,
      rawBody: RAW_BODY,
    });
    expect(() => makeGuard().canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the raw body is missing', () => {
    const ts = String(nowSeconds());
    const ctx = makeContext({
      signatureHeader: sign(SECRET, ts, RAW_BODY),
      timestampHeader: ts,
      rawBody: undefined,
    });
    expect(() => makeGuard().canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the raw body is neither string nor Buffer', () => {
    const ts = String(nowSeconds());
    const ctx = makeContext({
      signatureHeader: sign(SECRET, ts, RAW_BODY),
      timestampHeader: ts,
      rawBody: { parsed: RAW_BODY }, // e.g. capture flag missing → parsed body
    });
    expect(() => makeGuard().canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws InternalServerErrorException when the secret is not configured (fail closed)', () => {
    const ctx = makeContext({
      signatureHeader: 'sha256=deadbeef',
      timestampHeader: String(nowSeconds()),
      rawBody: RAW_BODY,
    });
    expect(() => makeGuard({}).canActivate(ctx)).toThrow(
      InternalServerErrorException,
    );
    expect(() => makeGuard({ secret: '' }).canActivate(ctx)).toThrow(
      InternalServerErrorException,
    );
  });
});
