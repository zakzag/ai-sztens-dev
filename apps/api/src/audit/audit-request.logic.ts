/**
 * Request facts for the audit row, extracted by pure functions (AIS-177 `D7`).
 *
 * The writer never reads Fastify: this helper does, once, per request. That
 * keeps `AuditWriter` unit-testable with plain objects and keeps the header
 * allow-list in one place instead of scattered through services.
 *
 * Every value is **validated against the storage**, not just copied:
 * `ip_address` is an `inet` column, so a proxy header holding
 * `"1.2.3.4, 10.0.0.1"` or `<unknown>` would make the insert fail — and a
 * failed audit insert rolls the business write back with it. A value we cannot
 * store honestly becomes `null`.
 */

import {
  AUDIT_IP_ADDRESS_MAX_LENGTH,
  AUDIT_REQUEST_ID_MAX_LENGTH,
  AUDIT_USER_AGENT_MAX_LENGTH,
} from '@callback/shared';
import type {
  HttpHeadersLike,
  HttpRequestLike,
} from '../common/http/request-context.interface.js';
import {
  AUDIT_IP_ADDRESS_PATTERN,
  AUDIT_SOURCE_ADMIN_API,
  USER_AGENT_HEADER,
} from './audit.const.js';
import type { AuditRequestFacts } from './audit.interface.js';

/**
 * The request subset the audit layer reads.
 *
 * `HttpRequestLike` is enough for the headers; the client address lives on
 * Fastify's own `ip` property, which the envelope layer does not need — hence
 * the small extension instead of widening the shared interface.
 */
export interface AuditRequestLike extends HttpRequestLike {
  /** Client address as Fastify resolved it (`req.ip`). */
  readonly ip?: unknown;
}

/** Reads one header case-insensitively; a repeated header arrives as an array. */
function readHeader(headers: HttpHeadersLike, name: string): string | null {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== name) {
      continue;
    }

    const candidate: unknown = Array.isArray(value) ? value[0] : value;

    return typeof candidate === 'string' ? candidate.trim() : null;
  }

  return null;
}

/** Trims and clips a text value, mapping the empty result to `null`. */
function toBoundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

/**
 * Validates a candidate address against what an `inet` column accepts.
 *
 * @param value - anything the framework exposed as the client address.
 * @returns the address, or `null` when it is missing or unrepresentable.
 */
export function toIpAddress(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > AUDIT_IP_ADDRESS_MAX_LENGTH) {
    return null;
  }

  return AUDIT_IP_ADDRESS_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * Builds the facts stored beside one audited write.
 *
 * @param request - the raw request (headers + `ip`).
 * @param requestId - the correlation id the envelope already resolved.
 * @param source - entry point; admin HTTP writes use `admin_api`.
 * @returns the three optional facts plus the source.
 */
export function toAuditRequestFacts(
  request: AuditRequestLike,
  requestId: unknown,
  source: AuditRequestFacts['source'] = AUDIT_SOURCE_ADMIN_API,
): AuditRequestFacts {
  return {
    ipAddress: toIpAddress(request.ip),
    userAgent: toBoundedText(
      readHeader(request.headers, USER_AGENT_HEADER),
      AUDIT_USER_AGENT_MAX_LENGTH,
    ),
    requestId: toBoundedText(requestId, AUDIT_REQUEST_ID_MAX_LENGTH),
    source,
  };
}
