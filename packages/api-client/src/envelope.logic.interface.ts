/**
 * Shapes of the pure envelope unwrap (plan `D12`).
 *
 * The result is a discriminated union on `ok`, so a caller cannot read `data`
 * without having proven the body was a valid envelope. On the failure branch the
 * paths are **payload-relative** (`identifier`, never `data.identifier`), which is
 * what lets the admin form map an issue onto a field without stripping anything.
 */

import type { z } from 'zod';
import type { ApiErrorDetail } from '@callback/shared';

/** The body was a valid `{ data, meta }` envelope and matched the caller schema. */
export interface EnvelopeUnwrapSuccess<T> {
  readonly ok: true;
  /** The unwrapped payload, already validated by the caller's schema. */
  readonly data: T;
}

/** The body was not a valid envelope, or its `data` did not match the schema. */
export interface EnvelopeUnwrapFailure {
  readonly ok: false;
  /** Payload-relative field issues; never empty (a drift always has a reason). */
  readonly issues: readonly ApiErrorDetail[];
  /** The zod error the issues were rendered from, kept for logs. */
  readonly cause: z.ZodError;
}

/** Either the payload or the reasons it could not be produced. */
export type EnvelopeUnwrapResult<T> =
  EnvelopeUnwrapSuccess<T> | EnvelopeUnwrapFailure;
