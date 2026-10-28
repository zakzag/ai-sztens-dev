/**
 * The `@SkipEnvelope()` + registry gate (AIS-97, plan key decision 5).
 *
 * What it enforces, per mounted route:
 *
 * | route | must | violation code |
 * |---|---|---|
 * | enveloped (no `@SkipEnvelope()`) | be registered in `API_ENDPOINTS` with the **same verb and path** | `UNREGISTERED_ENVELOPED_ROUTE` |
 * | exempt (`@SkipEnvelope()`) | appear in `ENVELOPE_EXEMPTIONS` | `EXEMPT_ROUTE_NOT_LISTED` |
 * | listed exemption | have a route that actually carries the decorator | `ORPHANED_EXEMPTION` |
 *
 * Why metadata and not source text: the gate has to survive a refactor (a
 * controller split into two files, a handler moved to a mixin). Nest's own
 * metadata is what the filter reads at runtime, so the gate reads the same
 * source of truth (plan key decision 5).
 *
 * The verb matters: `/api/api-keys` is registered for `GET` **and** `POST`, and a
 * path-level check would let a documented `GET` excuse an undocumented `DELETE`.
 *
 * The runtime *body* check is a different guarantee and lives in
 * `ResponseAssertInterceptor` (AIS-98): this audit proves the route cannot exist
 * undocumented, that one proves a documented route fulfils its schema.
 */

import { API_ENDPOINTS, ENVELOPE_EXEMPTIONS } from '@callback/shared';
import type { ApiEndpointContract, EnvelopeExemption } from '@callback/shared';
import {
  UNKNOWN_HTTP_METHOD,
  toMethodRoutes,
} from '../../src/common/http/test/support/envelope-route.js';
import type { MethodRoute } from '../../src/common/http/test/support/envelope-route.js';

/**
 * Enveloped routes that are deliberately kept out of the versioned registry.
 *
 * Only the root greeting: every registry path must live under `/api/`, and
 * `GET /api` exists to prove the envelope is wired, not as a client resource.
 */
export const ALLOWED_UNEXPLAINED_PATHS: readonly string[] = ['/api'];

/** Why a route failed the audit. */
export type AuditViolationCode =
  | 'UNREGISTERED_ENVELOPED_ROUTE'
  | 'EXEMPT_ROUTE_NOT_LISTED'
  | 'ORPHANED_EXEMPTION'
  | 'UNKNOWN_HTTP_METHOD';

/** One failed route, with enough context to fix it without re-running anything. */
export interface AuditViolation {
  /** What is wrong. */
  readonly code: AuditViolationCode;
  /** HTTP verb involved (`UNKNOWN` when the metadata is unreadable). */
  readonly method: string;
  /** Route path as Nest mounts it. */
  readonly path: string;
  /** Human-readable explanation, including the controller/handler names. */
  readonly detail: string;
}

/** Result of an audit run. */
export interface AuditResult {
  /** Every route the audit inspected. */
  readonly routes: readonly MethodRoute[];
  /** Rule violations; empty when the contract is complete. */
  readonly violations: readonly AuditViolation[];
}

/** Inputs of {@link auditEnvelopeContract}; all injectable for the self-test. */
export interface AuditOptions {
  /** Registry to compare against (defaults to `API_ENDPOINTS`). */
  readonly endpoints?: readonly ApiEndpointContract[];
  /** Exemption allow-list (defaults to `ENVELOPE_EXEMPTIONS`). */
  readonly exemptions?: readonly EnvelopeExemption[];
  /** Registered-but-unexplained paths that are accepted (defaults to the root probe). */
  readonly allowedUnexplainedPaths?: readonly string[];
}

/**
 * @param method - HTTP verb.
 * @param path - route path.
 * @returns the lookup key of a registry entry (`GET /api/api-keys`).
 */
function routeKey(method: string, path: string): string {
  return `${method} ${path}`;
}

/**
 * Audits the mounted controllers against the shared contract.
 *
 * @param controllers - controller classes, typically from `DiscoveryService`.
 * @param options - registry, exemptions and accepted exceptions.
 * @returns the inspected routes and every violation found.
 */
export function auditEnvelopeContract(
  controllers: readonly unknown[],
  options: AuditOptions = {},
): AuditResult {
  const endpoints = options.endpoints ?? API_ENDPOINTS;
  const exemptions = options.exemptions ?? ENVELOPE_EXEMPTIONS;
  const allowed = options.allowedUnexplainedPaths ?? ALLOWED_UNEXPLAINED_PATHS;

  const routes = toMethodRoutes(controllers);
  const registered = new Set(
    endpoints.map((entry) => routeKey(entry.method, entry.path)),
  );
  const exemptionPaths = new Set(exemptions.map((entry) => entry.path));
  const violations: AuditViolation[] = [];

  for (const route of routes) {
    if (route.method === UNKNOWN_HTTP_METHOD) {
      violations.push({
        code: 'UNKNOWN_HTTP_METHOD',
        method: route.method,
        path: route.path,
        detail: `${route.controller}.${route.handler} has a route path but no readable HTTP verb`,
      });
      continue;
    }

    if (route.exempt) {
      if (!exemptionPaths.has(route.path)) {
        violations.push({
          code: 'EXEMPT_ROUTE_NOT_LISTED',
          method: route.method,
          path: route.path,
          detail: `${route.controller}.${route.handler} is decorated with @SkipEnvelope() but missing from ENVELOPE_EXEMPTIONS`,
        });
      }
      continue;
    }

    if (registered.has(routeKey(route.method, route.path))) {
      continue;
    }

    if (allowed.includes(route.path)) {
      continue;
    }

    violations.push({
      code: 'UNREGISTERED_ENVELOPED_ROUTE',
      method: route.method,
      path: route.path,
      detail: `${route.controller}.${route.handler} answers with the envelope but is not registered in API_ENDPOINTS (add a contract entry, or @SkipEnvelope() + an exemption with a reason)`,
    });
  }

  const decoratedPaths = new Set(
    routes.filter((route) => route.exempt).map((route) => route.path),
  );

  for (const exemption of exemptions) {
    if (!decoratedPaths.has(exemption.path)) {
      violations.push({
        code: 'ORPHANED_EXEMPTION',
        method: 'ANY',
        path: exemption.path,
        detail: `ENVELOPE_EXEMPTIONS lists ${exemption.path} but no route carries @SkipEnvelope() for it`,
      });
    }
  }

  return { routes, violations };
}
