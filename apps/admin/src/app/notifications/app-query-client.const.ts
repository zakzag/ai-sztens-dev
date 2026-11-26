/**
 * Defaults of the application query client (AIS-84).
 *
 * They are values, not decisions: `createAppQueryClient` moves the client out of
 * `main.tsx` so the notification callbacks can be attached at construction time,
 * and these two numbers keep the retry/refetch behaviour **identical** to the
 * client that lived there before.
 */

/** One retry, so a flapping network does not multiply the log by ten. */
export const APP_QUERY_RETRY_ATTEMPTS = 1;

/** A refocusing tab must not re-run every query and flood the log panel. */
export const APP_REFETCH_ON_WINDOW_FOCUS = false;
