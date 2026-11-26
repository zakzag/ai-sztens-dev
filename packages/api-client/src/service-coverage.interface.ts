/**
 * Types of the registry ⇄ service coverage gate (AIS-110).
 *
 * The contract registry (`@callback/shared` → `API_ENDPOINTS`) is the single
 * description of the HTTP surface, and a service is the only thing allowed to
 * call an endpoint. Those two lists can drift apart in two directions, and both
 * are silent at runtime:
 *
 * - a **registered operation without a service method** — the endpoint exists,
 *   nothing can call it (this is exactly what happened to `apiKeys.update` and
 *   `apiKeys.remove` before AIS-110);
 * - a **service method without a registered operation** — code that performs an
 *   undocumented call, which the generated OpenAPI document will not mention.
 *
 * The gate therefore reports both, and the types here are deliberately narrow so
 * a failure names the operation instead of “something is missing”.
 */

import type { HttpClient } from './http-client.interface.js';

/**
 * Builds one resource service on top of the shared transport.
 *
 * `object` rather than a concrete interface: the factory map is keyed by the
 * registry namespace, so it cannot depend on any single resource's type. The
 * method names are compared at runtime by {@link findCoverageGaps}.
 */
export type ServiceFactory = (client: HttpClient) => object;

/** Registry namespace (`apiKeys`) → the factory of its service. */
export type ServiceFactories = Readonly<Record<string, ServiceFactory>>;

/** Built services, keyed by registry namespace. */
export type ServiceInstances = Readonly<Record<string, object>>;

/** Why one operation has no callable counterpart. */
export type CoverageGapReason = 'missing-service' | 'missing-method';

/** One registered operation the client cannot call. */
export interface CoverageGap {
  /** The registry key, e.g. `apiKeys.update`. */
  readonly operationId: string;
  /** First segment of the id, i.e. the service namespace. */
  readonly namespace: string;
  /** Last segment of the id, i.e. the expected method name. */
  readonly method: string;
  /** Whether the whole service or only the method is absent. */
  readonly reason: CoverageGapReason;
}

/** Verdict of the coverage gate. Empty in both lists means “in sync”. */
export interface ServiceCoverage {
  /** Registered operations with no service method. */
  readonly missing: readonly CoverageGap[];
  /** Service methods no registered operation names. */
  readonly orphan: readonly string[];
}
