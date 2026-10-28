/**
 * Constructor contract of {@link AppError} (plan `D7`, `D8`).
 *
 * `code` is the only decision key: the HTTP status is **derived** from the shared
 * catalogue (`resolveApiErrorStatus`), so a service that says “identifier
 * conflict” can never accidentally ship it with a `500`.
 *
 * The type is the shared `ApiErrorCode` on purpose: the server cannot raise a
 * code the deployed client does not know, because such a call does not compile.
 * The runtime fallback in `resolveApiErrorStatus` still exists for codes coming
 * from *outside* (a newer server answering an old bundle), not for our own code.
 */

import type { ApiErrorCode, ApiErrorDetail } from '@callback/shared';

/** Everything a domain service may state about its own failure. */
export interface AppErrorInit {
  /** One of `API_ERROR_CODE`; the shared catalogue is the only vocabulary. */
  readonly code: ApiErrorCode;
  /** English developer message — never rendered as user copy. */
  readonly message: string;
  /** Field-level issues for form mapping; omitted means “no field is at fault”. */
  readonly details?: readonly ApiErrorDetail[];
  /** Original failure, kept for the server log only. */
  readonly cause?: unknown;
}
