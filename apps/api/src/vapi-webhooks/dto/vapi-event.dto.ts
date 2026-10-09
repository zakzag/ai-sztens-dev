/**
 * Inbound VAPI webhook payload types.
 *
 * The VAPI service surface is intentionally permissive: we only require
 * the minimum fields the guard / downstream services need to identify
 * the event (id, type, optional call id), and allow the rest of the
 * payload through as an open shape. VAPI evolves its payload between
 * versions; capturing only the strict minimum keeps the contract stable
 * across VAPI updates.
 *
 * The exact schema is verified at integration time against the live VAPI
 * docs (https://docs.vapi.ai/server-url/events). If a future field
 * becomes mandatory (e.g. a discriminator on `end-of-call-report`),
 * add it as an optional field here and tighten the controller.
 */

/** A single event delivered by VAPI to our webhook receiver. */
export interface VapiEvent {
  /** VAPI message id, used for idempotency / log lookup. */
  id: string;
  /** Discriminator for which endpoint the event came in on
   *  (`tool-calls`, `end-of-call-report`, `status-update`, ...). */
  type: string;
  /** ISO timestamp emitted by VAPI (informational; the request-level
   *  `X-Vapi-Timestamp` header is what the guard uses for freshness). */
  timestamp?: string;
  /** VAPI call id, when the event is scoped to a single call. */
  call?: {
    id: string;
  };
  /** Anything VAPI may add in future versions — captured but not parsed. */
  [extra: string]: unknown;
}

/** Body type for `POST /api/vapi/webhooks/tool-calls`. */
export type VapiToolCallsEvent = VapiEvent;

/** Body type for `POST /api/vapi/webhooks/end-of-call-report`. */
export type VapiEndOfCallReportEvent = VapiEvent;
