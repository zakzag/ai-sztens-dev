/**
 * The single ISO 8601 date-time schema of the HTTP contract.
 *
 * Every timestamp on the wire — envelope `meta.timestamp`, `createdAt`,
 * `updatedAt`, `expiresAt` — is parsed with this one schema, so the answer to
 * “is this date acceptable” is written in exactly one place.
 *
 * A naked local timestamp (`2026-11-01T00:00:00`) is rejected on purpose: it
 * would be interpreted in the *browser's* timezone, which silently shifts the
 * stored moment.
 */

import { z } from 'zod';

/** ISO 8601 date-time with an explicit offset (`Z` or `+02:00`). */
export const isoDateTimeSchema = z.string().datetime({ offset: true });
