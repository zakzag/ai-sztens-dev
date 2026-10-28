/**
 * The endpoint registry and the documented envelope exemptions (plan `D9`).
 *
 * Why both live in one file: the two lists are read together by the future
 * coverage test (“every controller route is either registered or explicitly
 * exempt”), and keeping them apart would make it possible to add an exemption
 * without a reason.
 */

import { API_KEYS_ENDPOINTS } from './api-keys/api-keys.contract.js';
import type { ApiEndpointContract } from './endpoint.interface.js';

/** Every enveloped endpoint the contract knows. */
export const API_ENDPOINTS: readonly ApiEndpointContract[] = [
  ...API_KEYS_ENDPOINTS,
];

/**
 * One route that deliberately does **not** use the envelope.
 *
 * `reason` is mandatory: an exemption is a written decision, not an omission.
 */
export interface EnvelopeExemption {
  /** Route as mounted by Nest (incl. the global `api` prefix where applied). */
  readonly path: string;
  /** Why the route keeps its raw body. */
  readonly reason: string;
}

/** The allow-list of raw-body routes. */
export const ENVELOPE_EXEMPTIONS: readonly EnvelopeExemption[] = [
  {
    path: '/healthz',
    reason:
      'Docker healthcheck and the monitor watchdog parse a bare {status} body.',
  },
  {
    path: '/api/vapi/webhooks/tool-calls',
    reason: 'Provider-owned contract: VAPI expects its own response body.',
  },
  {
    path: '/api/vapi/webhooks/end-of-call-report',
    reason: 'Provider-owned contract: VAPI expects its own response body.',
  },
];

/**
 * @param operationId - registry key to look up.
 * @returns the matching entry, or `undefined` when the id is not registered.
 */
export function findEndpoint(
  operationId: string,
): ApiEndpointContract | undefined {
  return API_ENDPOINTS.find((entry) => entry.operationId === operationId);
}
