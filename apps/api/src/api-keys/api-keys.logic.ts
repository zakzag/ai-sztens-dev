/**
 * Pure business rules of the `api-keys` feature (AIS-108).
 *
 * "Pure" is the point: a rule that decides whether a request is *semantically*
 * impossible must not read the clock itself, otherwise every test would need
 * fake timers and the rule would silently depend on the machine. `now` is
 * always a parameter.
 *
 * No Nest, no Drizzle, no I/O — which is also why this file can be imported by
 * a script or a worker without dragging the HTTP stack along.
 */

/**
 * Decides whether an ISO 8601 instant lies strictly in the past.
 *
 * Used for the one semantic rule this ticket ships: an `expiresAt` that is
 * already behind us cannot produce a valid credential, so the request is a
 * `422 SEMANTIC_VALIDATION_FAILED` instead of a stored-but-useless row.
 *
 * Boundary: `expiresAt === now` is **allowed**. Rejecting “expires this very
 * millisecond” would make the rule depend on clock precision rather than on the
 * user's intent, and an expiry that is exactly now is a deliberate input, not a
 * typo. Only `expiresAt < now` is a failure.
 *
 * An unparsable input yields `false`: shape is the zod schema's job (it already
 * rejected a non-ISO string with a `400`), so this function never has to turn a
 * parse failure into a second, competing validation error.
 *
 * @param iso - the instant to check, as an ISO 8601 string.
 * @param now - reference instant, injected so the caller owns the clock.
 * @returns `true` only when `iso` is strictly earlier than `now`.
 */
export function isPastDate(iso: string, now: Date): boolean {
  const value = Date.parse(iso);

  if (Number.isNaN(value)) {
    return false;
  }

  return value < now.getTime();
}
