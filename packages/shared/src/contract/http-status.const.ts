/**
 * The HTTP statuses of the API contract (D5 of the API convention plan).
 *
 * One table, used by both sides of the wire: the server picks the status from
 * here through {@link API_ERROR_CODE_STATUS}, and `packages/api-client` reacts
 * to the same symbols instead of keeping its own copy. A status that is not in
 * this table is not part of the contract, so a client never has to guess what a
 * numeric literal means.
 */

/** HTTP statuses named after what they mean in this contract. */
export const HTTP_STATUS = {
  /** Read / update / delete succeeded. */
  OK: 200,
  /** Resource created. */
  CREATED: 201,
  /** Malformed request shape. */
  BAD_REQUEST: 400,
  /** No authentication (or an expired session). */
  UNAUTHORIZED: 401,
  /** Authenticated but not allowed. */
  FORBIDDEN: 403,
  /** Resource does not exist. */
  NOT_FOUND: 404,
  /** Unique-constraint or state conflict. */
  CONFLICT: 409,
  /** Body over the configured limit. */
  PAYLOAD_TOO_LARGE: 413,
  /** Shape is valid, but the semantics are not. */
  UNPROCESSABLE_ENTITY: 422,
  /** Rate limit exceeded. */
  TOO_MANY_REQUESTS: 429,
  /** Unexpected server failure — details stay in the server log. */
  INTERNAL_SERVER_ERROR: 500,
  /** A dependency (database, provider) is unavailable. */
  SERVICE_UNAVAILABLE: 503,
} as const;

/** Union of the statuses declared above. */
export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
