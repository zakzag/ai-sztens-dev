import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  VAPI_WEBHOOK_CONFIG,
  type VapiWebhookConfig,
} from './vapi-webhook-config.js';

/**
 * Minimal shape of the Fastify request we need to inspect. Defined here
 * (rather than imported from `fastify`) so the guard stays
 * `isolatedModules`-clean: this file has zero runtime dependency on any
 * NestJS or Fastify type, only on `node:crypto` and the standard library.
 */
interface VapiIncomingRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: unknown;
}

/**
 * VapiSignatureGuard — HMAC-SHA256 authenticator for inbound VAPI webhooks.
 *
 * The Caddy layer (`infra/caddy/Caddyfile`, `handle @vapi_match`) already
 * rejects requests that are not POST and do not carry an `X-Vapi-Signature`
 * header with a 405 — that is cheap, header-only protection. This guard is
 * the *real* authentication: it re-derives the HMAC over the **raw** request
 * body and compares it to the signature the client sent, in constant time.
 *
 * Wire contract (assumed — verify against VAPI docs at integration time):
 *   - `X-Vapi-Signature: sha256=<hex>`     (lowercase hex)
 *   - `X-Vapi-Timestamp: <unix-seconds>`   (optional, but REQUIRED by us
 *     because we enforce a freshness window to limit replay attacks)
 *   - signed payload = `${timestamp}.${rawBody}`
 *   - secret = the `secret` field of the injected `VAPI_WEBHOOK_CONFIG`
 *     (bound to `VAPI_WEBHOOK_SECRET` by `vapi-webhooks.module.ts`)
 *
 * Dependency injection
 * --------------------
 * The configuration arrives through the `VAPI_WEBHOOK_CONFIG` symbol token and
 * not through `ConfigService`. That keeps this bounded context independent of
 * the (CommonJS-only) `@nestjs/config` package and removes a per-request
 * `config.get()` lookup; the value itself is still the same env var.
 *
 * Why `rawBody`?
 *   - `rawBody` is required because the JSON parser may re-serialise the
 *     body (key order, unicode escapes, whitespace) and any change would
 *     invalidate the HMAC. `main.ts` enables Fastify's rawBody capture for
 *     this exact reason.
 *   - Nest's Fastify adapter registers the JSON parser with
 *     `parseAs: 'buffer'`, so `request.rawBody` is a **Buffer**, not a
 *     string. Both a Buffer and a string are accepted here; anything else
 *     means the raw body was not captured and we must reject (see below).
 *
 * Failure mode policy:
 *   - **Missing / unconfigured secret** → `InternalServerErrorException`
 *     (500). This is the "fail closed" stance: a missing secret in prod
 *     is a configuration bug, not a client problem. We refuse to authenticate
 *     anyone rather than accidentally allow unauthenticated traffic.
 *   - **Any client-side mismatch** (missing header, bad signature, stale
 *     timestamp, malformed header value) → `UnauthorizedException` (401).
 *     We do not differentiate the reasons in the response to avoid
 *     fingerprinting the secret/version.
 *   - **Missing raw body** → 401, because without the byte-exact payload the
 *     HMAC cannot be recomputed; silently allowing the request would be a
 *     security regression.
 *
 * The guard NEVER logs the secret. It logs only the reason and the
 * valid/invalid status, so the secret cannot leak through log scraping.
 */
@Injectable()
export class VapiSignatureGuard implements CanActivate {
  private readonly logger = new Logger(VapiSignatureGuard.name);

  /** Default window in seconds; can be overridden by `VAPI_WEBHOOK_CONFIG`. */
  private static readonly DEFAULT_TOLERANCE_SECONDS = 300;

  constructor(
    @Inject(VAPI_WEBHOOK_CONFIG) private readonly config: VapiWebhookConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<VapiIncomingRequest>();
    const headers = request.headers;

    // --- 1. Secret (fail closed on misconfiguration) -------------------
    const secret = this.config.secret;
    if (!secret || secret.length === 0) {
      this.logger.error(
        'VAPI_WEBHOOK_SECRET is not configured; rejecting webhook (fail closed).',
      );
      throw new InternalServerErrorException(
        'VAPI webhook secret is not configured.',
      );
    }

    // --- 2. Headers ---------------------------------------------------
    const signatureHeader = this.headerString(headers['x-vapi-signature']);
    const timestampHeader = this.headerString(headers['x-vapi-timestamp']);
    if (!signatureHeader || !timestampHeader) {
      this.logger.warn(
        `VAPI webhook rejected: missing signature/timestamp header (sig=${Boolean(
          signatureHeader,
        )}, ts=${Boolean(timestampHeader)}).`,
      );
      throw new UnauthorizedException('Missing VAPI signature headers.');
    }

    // --- 3. Timestamp freshness (anti-replay) -------------------------
    const tolerance = this.readToleranceSeconds();
    const tsNum = Number(timestampHeader);
    if (!Number.isFinite(tsNum)) {
      this.logger.warn(
        'VAPI webhook rejected: X-Vapi-Timestamp is not a number.',
      );
      throw new UnauthorizedException('Invalid VAPI timestamp.');
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - tsNum) > tolerance) {
      this.logger.warn(
        `VAPI webhook rejected: timestamp drift ${Math.abs(
          nowSeconds - tsNum,
        )}s exceeds tolerance ${tolerance}s.`,
      );
      throw new UnauthorizedException('Stale VAPI timestamp.');
    }

    // --- 4. Parse the signature header --------------------------------
    // Expected shape: `sha256=<hex>` (version-prefixed for future-proofing).
    const parsed = this.parseSignatureHeader(signatureHeader);
    if (!parsed) {
      this.logger.warn(
        'VAPI webhook rejected: X-Vapi-Signature has the wrong shape.',
      );
      throw new UnauthorizedException('Malformed VAPI signature header.');
    }

    // --- 5. Raw body --------------------------------------------------
    // `request.rawBody` is populated by the Fastify content-type parser
    // when `rawBody: true` is set in the Nest *application* options (see
    // main.ts). It is the byte-exact payload the VAPI server sent, delivered
    // as a Buffer (`parseAs: 'buffer'`).
    const rawBody = this.rawBodyToString(request.rawBody);
    if (rawBody === null) {
      // Without the raw body we cannot recompute the HMAC. Reject rather
      // than guess (silently allowing auth would be a security regression).
      this.logger.error(
        'VAPI webhook rejected: rawBody missing on request (check main.ts rawBody option).',
      );
      throw new UnauthorizedException(
        'Cannot verify signature: raw body missing.',
      );
    }

    // --- 6. Recompute the HMAC and compare in constant time -----------
    const expected = createHmac('sha256', secret)
      .update(`${timestampHeader}.${rawBody}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(parsed.hex, 'utf8');
    // timingSafeEqual requires equal-length buffers; an attacker that
    // sends a malformed hex must still hit the constant-time path, so we
    // bail out explicitly on a length mismatch instead of comparing.
    if (expectedBuf.length !== providedBuf.length) {
      this.logger.warn(
        `VAPI webhook rejected: signature length mismatch (expected ${expectedBuf.length} hex chars).`,
      );
      throw new UnauthorizedException('Invalid VAPI signature.');
    }
    const ok = timingSafeEqual(expectedBuf, providedBuf);
    if (!ok) {
      this.logger.warn('VAPI webhook rejected: HMAC mismatch.');
      throw new UnauthorizedException('Invalid VAPI signature.');
    }

    // Success — the controller can proceed.
    return true;
  }

  /**
   * Reads the tolerance window (seconds) from the injected configuration.
   * Anything that fails to parse to a positive number falls back to the
   * default; this keeps the guard safe to operate even with a partially
   * broken env file.
   */
  private readToleranceSeconds(): number {
    const raw = this.config.toleranceSeconds;
    if (raw === undefined || !Number.isFinite(raw) || raw <= 0) {
      return VapiSignatureGuard.DEFAULT_TOLERANCE_SECONDS;
    }
    return Math.floor(raw);
  }

  /**
   * Normalises `request.rawBody` to the exact string the HMAC was computed
   * over. Nest's Fastify adapter hands us a Buffer; a string is also accepted
   * so the guard does not silently break if the capture mechanism changes
   * (and so tests can feed either shape). Anything else → `null` (reject).
   */
  private rawBodyToString(rawBody: unknown): string | null {
    if (Buffer.isBuffer(rawBody)) return rawBody.toString('utf8');
    if (typeof rawBody === 'string') return rawBody;
    return null;
  }

  /**
   * Parses `sha256=<hex>` (or `sha256=v1=<hex>`) and returns the hex part,
   * or `null` if the shape is wrong. The `v1` segment is reserved for
   * future scheme versions; the current guard accepts both
   * `sha256=<hex>` and `sha256=v1=<hex>`. New schemes can be added by
   * branching on the prefix without breaking the existing one.
   */
  private parseSignatureHeader(header: string): { hex: string } | null {
    const lower = header.trim().toLowerCase();
    // IMPORTANT: check the LONGER prefix first — `sha256=v1=` starts with
    // `sha256=`, so the plain-prefix branch must come second.
    if (lower.startsWith('sha256=v1=')) {
      const hex = lower.slice('sha256=v1='.length);
      if (!/^[0-9a-f]+$/.test(hex) || hex.length === 0) return null;
      return { hex };
    }
    if (lower.startsWith('sha256=')) {
      const hex = lower.slice('sha256='.length);
      if (!/^[0-9a-f]+$/.test(hex) || hex.length === 0) return null;
      return { hex };
    }
    return null;
  }

  private headerString(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) return value[0] ?? null;
    if (typeof value === 'string' && value.length > 0) return value;
    return null;
  }
}
