/**
 * Constructor contract of {@link AppError} (plan `D7`).
 *
 * `code` is the only decision key: the HTTP status is **derived** from the shared
 * catalogue (`resolveApiErrorStatus`), so a service that says “identifier
 * conflict” can never accidentally ship it with a `500`.
 */

import type { ApiErrorDetail } from '@callback/shared';

/** Everything a domain service may state about its own failure. */
export interface AppErrorInit {
  /** One of `API_ERROR_CODE`; anything else maps to `500`. */
  readonly code: string;
  /** English developer message — never rendered as user copy. */
  readonly message: string;
  /** Field-level issues for form mapping; omitted means “no field is at fault”. */
  readonly details?: readonly ApiErrorDetail[];
  /** Original failure, kept for the server log only. */
  readonly cause?: unknown;
}
