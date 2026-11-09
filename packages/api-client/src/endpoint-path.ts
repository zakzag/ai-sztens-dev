/**
 * Turns registry paths into transport paths (AIS-89).
 *
 * A service must never write a route by hand: the path is documented once in
 * `@callback/shared` (`API_ENDPOINTS`, mounted under the global `/api` prefix),
 * while the transport is configured with a base URL that **already contains**
 * that prefix (`apps/admin/src/services/api-client.const.ts`). This module is
 * the single conversion point between the two, so a route rename breaks the
 * registry entry only instead of silently leaving a stale literal behind.
 */

import { API_PATH_PREFIX, findEndpoint } from '@callback/shared';

/** Thrown when an operation id is not part of the registry. */
export class UnknownEndpointError extends Error {
  /** The id that was looked up. */
  readonly operationId: string;

  /**
   * @param operationId - the registry key that could not be resolved.
   */
  constructor(operationId: string) {
    super(`Operation "${operationId}" is not part of the API contract.`);
    this.name = 'UnknownEndpointError';
    this.operationId = operationId;
  }
}

/** Thrown when a registry path does not start with the global API prefix. */
export class InvalidEndpointPathError extends Error {
  /** The path that could not be converted. */
  readonly endpointPath: string;

  /**
   * @param endpointPath - the registry path that lacks the expected prefix.
   */
  constructor(endpointPath: string) {
    super(
      `Registry path "${endpointPath}" does not start with "${API_PATH_PREFIX}/".`,
    );
    this.name = 'InvalidEndpointPathError';
    this.endpointPath = endpointPath;
  }
}

/** Thrown when a transport path still contains a `:parameter` placeholder. */
export class UnresolvedPathParameterError extends Error {
  /** The path that still carries a placeholder. */
  readonly path: string;

  /**
   * @param path - the path the transport was asked to call.
   */
  constructor(path: string) {
    super(
      `Path "${path}" still contains a ":parameter" placeholder; substitute it before calling the transport.`,
    );
    this.name = 'UnresolvedPathParameterError';
    this.path = path;
  }
}

/**
 * Matches a `:parameter` placeholder in a **path segment**.
 *
 * Anchored to the start of the string or a slash on purpose: a colon inside a
 * value (`?since=12:30`) is data, not a placeholder, and must not be rejected.
 */
const PATH_PARAMETER = /(?:^|\/):[A-Za-z0-9_]+/;

/**
 * @param path - a transport path, optionally carrying a query string.
 * @returns `true` when the pathname still contains a `:parameter` placeholder.
 */
export function hasUnresolvedPathParameter(path: string): boolean {
  const queryIndex = path.indexOf('?');
  const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex);

  return PATH_PARAMETER.test(pathname);
}

/**
 * Rejects a path whose `:parameter` was never substituted.
 *
 * `clientPathOf('apiKeys.remove')` returns `/api-keys/:identifier`, and only the
 * service knows the identifier. Without this guard a forgotten substitution
 * would send a literal `:identifier` and surface as a confusing `400`/`404`;
 * instead it fails here, naming the path.
 *
 * @param path - the path the transport is about to call.
 * @throws {UnresolvedPathParameterError} when a placeholder is still present.
 */
export function assertNoUnresolvedPathParameter(path: string): void {
  if (hasUnresolvedPathParameter(path)) {
    throw new UnresolvedPathParameterError(path);
  }
}

/**
 * Strips the global API prefix from a registry path.
 *
 * Pure: no registry lookup, no transport knowledge, so every branch is testable
 * with a literal.
 *
 * @param endpointPath - path as it appears in a registry entry (`/api/api-keys`).
 * @returns the same path relative to a base URL that ends in `/api` (`/api-keys`).
 * @throws {InvalidEndpointPathError} when the prefix is missing — a bare
 * `/healthz` or a path without the leading slash would otherwise turn into a
 * request the server cannot route.
 */
export function toClientPath(endpointPath: string): string {
  if (!endpointPath.startsWith(`${API_PATH_PREFIX}/`)) {
    throw new InvalidEndpointPathError(endpointPath);
  }

  return endpointPath.slice(API_PATH_PREFIX.length);
}

/**
 * Resolves an `operationId` to the path the transport should call.
 *
 * @param operationId - stable registry key, e.g. `apiKeys.list`.
 * @returns the path relative to the injected base URL, e.g. `/api-keys`.
 * @throws {UnknownEndpointError} when the id is not registered.
 */
export function clientPathOf(operationId: string): string {
  const endpoint = findEndpoint(operationId);

  if (endpoint === undefined) {
    throw new UnknownEndpointError(operationId);
  }

  return toClientPath(endpoint.path);
}
