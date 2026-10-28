/**
 * Metadata key of the `@SkipEnvelope()` opt-out (plan `D9`).
 *
 * The key is a namespaced string so a future library using `SetMetadata` cannot
 * collide with it. It lives in its own constant file because both the decorator
 * (writer) and the exception filter (reader) need it, and importing the
 * decorator into the filter would drag Nest's decorator machinery into a place
 * that only reads metadata.
 */

/** Stable metadata key of the raw-body exemption flag. */
export const SKIP_ENVELOPE_KEY = 'callback:skip-envelope';
