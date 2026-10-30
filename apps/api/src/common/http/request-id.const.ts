/**
 * Limits and the character set of a correlation id (AIS-92, plan `D10`).
 *
 * The inbound `X-Request-Id` is **attacker-controlled**: it lands in a response
 * header and in every structured log line, so an unchecked value would allow
 * header splitting and log forging. The allow-list is deliberately narrow —
 * only what Caddy, a browser `crypto.randomUUID()` and the common tracing
 * formats (`traceparent`-style `:`/`-`) actually need.
 */

/** Maximum accepted length of an inbound correlation id. */
export const REQUEST_ID_MAX_LENGTH = 128;

/**
 * Accepted inbound correlation id characters: letters, digits, dot, underscore,
 * colon and dash. No whitespace, no newline, no header/prompt control character.
 */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
