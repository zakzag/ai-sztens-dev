/**
 * Pure rules of the registry ⇄ service coverage gate (AIS-110).
 *
 * No `fetch`, no client, no registry import: the operation ids and the built
 * services are passed in, so every branch — including the negative ones that the
 * gate exists for — is unit-testable with plain values.
 *
 * The method name is **derived**, not declared: `apiKeys.findByIdentifier` means
 * “the `apiKeys` service must expose `findByIdentifier`”. That is what lets a new
 * resource ship without touching this module or the test — only a new line in
 * `service.registry.ts`.
 */

import type {
  CoverageGap,
  ServiceCoverage,
  ServiceInstances,
} from './service-coverage.interface.js';
import {
  InvalidOperationIdError,
  type InvalidOperationIdReason,
} from './service-coverage.errors.js';

/** Separator of the two `operationId` segments. */
const OPERATION_ID_SEPARATOR = '.';

/** Number of segments a conforming `operationId` carries. */
const OPERATION_ID_SEGMENTS = 2;

/**
 * Views any built service as an indexable bag of members.
 *
 * Needed because a service is typed by its own interface (no implicit index
 * signature), while the gate has to look members up by a string it derived at
 * runtime. The value is only ever read, never mutated.
 *
 * @param service - a built service instance.
 * @returns the same object, indexable by member name.
 */
function toMemberBag(service: object): Record<string, unknown> {
  return service as Record<string, unknown>;
}

/**
 * @param operationId - a registry key.
 * @returns the two segments of the id, in order.
 * @throws {InvalidOperationIdError} when the id is not `<namespace>.<action>`.
 */
function splitOperationId(operationId: string): readonly [string, string] {
  const segments = operationId.split(OPERATION_ID_SEPARATOR);

  if (segments.length === 1) {
    throw new InvalidOperationIdError(operationId, 'missing-separator');
  }

  if (segments.length > OPERATION_ID_SEGMENTS) {
    throw new InvalidOperationIdError(operationId, 'extra-segments');
  }

  const [namespace, method] = segments;

  if (
    namespace === undefined ||
    method === undefined ||
    emptyIn([namespace, method])
  ) {
    throw new InvalidOperationIdError(operationId, 'empty-segment');
  }

  return [namespace, method];
}

/**
 * @param segments - id segments to check.
 * @returns `true` when any segment is empty (`.list`, `apiKeys.`).
 */
function emptyIn(segments: readonly string[]): boolean {
  return segments.some((segment) => segment.length === 0);
}

/**
 * @param operationId - a registry key, e.g. `apiKeys.update`.
 * @returns the service namespace, i.e. the key in the factory map.
 * @throws {InvalidOperationIdError} when the id is not `<namespace>.<action>`.
 */
export function toServiceNamespace(operationId: string): string {
  return splitOperationId(operationId)[0];
}

/**
 * @param operationId - a registry key, e.g. `apiKeys.update`.
 * @returns the method name the service must expose.
 * @throws {InvalidOperationIdError} when the id is not `<namespace>.<action>`.
 */
export function toServiceMethodName(operationId: string): string {
  return splitOperationId(operationId)[1];
}

/**
 * @param service - a built service instance.
 * @param method - name derived from an `operationId`.
 * @returns `true` only for an **own** member that is a function — an inherited
 *   `toString` must not satisfy the gate.
 */
function hasMethod(service: object, method: string): boolean {
  const bag = toMemberBag(service);

  return Object.hasOwn(bag, method) && typeof bag[method] === 'function';
}

/**
 * @param service - a built service instance.
 * @returns its own function-valued member names, in declaration order.
 */
function toMethodNames(service: object): readonly string[] {
  return Object.keys(service).filter((name) => hasMethod(service, name));
}

/**
 * Compares the registry with the built services in both directions.
 *
 * @param operationIds - every registered `operationId` (`API_ENDPOINTS`).
 * @param services - built services, keyed by registry namespace.
 * @returns the registered operations nothing can call, plus the service methods
 *   no operation documents. Both empty means the two lists are in sync; the
 *   orphan list is sorted so the failure message is stable across runs.
 * @throws {InvalidOperationIdError} when an id is not `<namespace>.<action>`.
 */
export function findCoverageGaps(
  operationIds: readonly string[],
  services: ServiceInstances,
): ServiceCoverage {
  const missing: CoverageGap[] = [];
  const covered = new Set<string>();

  for (const operationId of operationIds) {
    const namespace = toServiceNamespace(operationId);
    const method = toServiceMethodName(operationId);
    const service = services[namespace];

    if (service === undefined) {
      missing.push({
        operationId,
        namespace,
        method,
        reason: 'missing-service',
      });
      continue;
    }

    if (!hasMethod(service, method)) {
      missing.push({
        operationId,
        namespace,
        method,
        reason: 'missing-method',
      });
      continue;
    }

    covered.add(operationId);
  }

  const orphan: string[] = [];

  for (const [namespace, service] of Object.entries(services)) {
    for (const method of toMethodNames(service)) {
      const operationId = `${namespace}${OPERATION_ID_SEPARATOR}${method}`;

      if (!covered.has(operationId)) {
        orphan.push(operationId);
      }
    }
  }

  return { missing, orphan: orphan.sort() };
}
