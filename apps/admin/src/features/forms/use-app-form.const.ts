/**
 * Constants of the shared form pattern (AIS-115).
 *
 * Kept out of the hook so the value is importable by a test without pulling the
 * hook (and therefore React) into a pure assertion.
 */

/**
 * The `type` a server-mapped message is registered under.
 *
 * react-hook-form uses `type` to tell messages apart; `server` means “this value
 * was accepted by the client schema and rejected by the backend”, which keeps a
 * later `zodResolver` run from confusing it with a client validation message.
 */
export const APP_FORM_FIELD_ERROR_TYPE = 'server';
