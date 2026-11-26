/**
 * Path building of the `api-keys` detail route.
 *
 * Kept out of the service so the substitution is a pure, testable function: the
 * registry owns the template (`/api-keys/:identifier`), the service only says
 * *which* identifier to address, and this module is the only place that knows
 * how the placeholder looks.
 */

import { API_KEYS_IDENTIFIER_PARAM } from '@callback/shared';
import { API_KEYS_DETAIL_PATH } from './api-keys.const.js';

/**
 * Substitutes the identifier into the single-resource path.
 *
 * The identifier is URL-encoded: the contract restricts it to URL-safe
 * characters, but encoding here means an unexpected value can only produce a
 * `404`, never an unroutable request.
 *
 * @param identifier - unique, URL-safe key of the resource.
 * @returns the path relative to the injected base URL, e.g. `/api-keys/vapi-staging`.
 */
export function toApiKeyDetailPath(identifier: string): string {
  return API_KEYS_DETAIL_PATH.replace(
    API_KEYS_IDENTIFIER_PARAM,
    encodeURIComponent(identifier),
  );
}
