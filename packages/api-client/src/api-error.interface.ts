/**
 * Shapes describing an error raised by the API client (plan `D12`).
 *
 * Two bodies are understood:
 *
 * 1. **The contract envelope** — `{ error: { code, status, message, details,
 *    requestId, timestamp, path } }`. `code` is the decision key.
 * 2. **The legacy / proxy body** — Nest's `{ statusCode, message, error }` or a
 *    Caddy/nginx HTML page. It must not break the client (plan `D12`: the
 *    tolerant path stays), it just yields fewer facts.
 *
 * Both are parsed by {@link parseErrorBody}, so the rest of the package never
 * branches on the shape.
 */

import type { ApiErrorDetail } from '@callback/shared';

/** Legacy Nest / proxy error body. */
export interface ApiErrorBody {
  readonly statusCode?: number;
  readonly message?: string | readonly string[];
  readonly error?: string;
}

/** Untrusted envelope body, i.e. `{ error: … }` before validation. */
export interface ApiErrorEnvelopeBody {
  readonly error?: {
    readonly code?: unknown;
    readonly status?: unknown;
    readonly message?: unknown;
    readonly requestId?: unknown;
    readonly details?: unknown;
  };
}

/** Constructor options of {@link ApiError}. */
export interface ApiErrorInit {
  /** Technical, English message (never rendered as-is). */
  readonly message: string;
  /** HTTP status, or `null` when the request never produced a response. */
  readonly status: number | null;
  /** Absolute request URL, for logs. */
  readonly url?: string | null;
  /** Stable machine code from the error envelope (`null` when not provided). */
  readonly code?: string | null;
  /** Correlation id of the failed request (`null` when not provided). */
  readonly requestId?: string | null;
  /** Field-level issues, mapped onto form fields by the admin. */
  readonly issues?: readonly ApiErrorDetail[];
  /** Rendered detail lines (`path: message`), kept for existing callers. */
  readonly details?: readonly string[];
  /** Original failure, kept for logging. */
  readonly cause?: unknown;
}

/** What {@link parseErrorBody} could extract from an untrusted body. */
export interface ParsedErrorBody {
  /** Envelope message, or the first legacy message; `null` when absent. */
  readonly message: string | null;
  /** Envelope code; `null` for a legacy body. */
  readonly code: string | null;
  /** Envelope requestId; `null` for a legacy body. */
  readonly requestId: string | null;
  /** Envelope field details; `[]` for a legacy body. */
  readonly issues: readonly ApiErrorDetail[];
  /** Rendered lines for the UI (`path: message` or the bare message). */
  readonly details: readonly string[];
}
