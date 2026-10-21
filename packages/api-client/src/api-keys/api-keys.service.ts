/**
 * Implementation of {@link ApiKeysService}.
 *
 * The service contains no logic of its own: it names the endpoints and binds
 * them to the shared zod schemas. Validation of the payload is the backend's
 * job (and the form's, for UX); parsing of the *response* is this layer's, so a
 * contract drift surfaces here instead of inside a component.
 */

import {
  apiKeyListSchema,
  apiKeySchema,
  type ApiKey,
  type CreateApiKeyInput,
} from '@callback/shared';
import { API_KEYS_PATH } from './api-keys.const.js';
import type { ApiKeysService } from './api-keys.interface.js';
import type { HttpClient } from '../http-client.interface.js';

/**
 * Creates the service on top of an injected transport.
 *
 * @param client - HTTP transport (base URL and token supplier already bound).
 * @returns the service consumed by the query hooks.
 */
export function createApiKeysService(client: HttpClient): ApiKeysService {
  return {
    list: async (): Promise<readonly ApiKey[]> =>
      client.get(API_KEYS_PATH, apiKeyListSchema),

    create: async (input: CreateApiKeyInput): Promise<ApiKey> =>
      client.post(API_KEYS_PATH, input, apiKeySchema),
  };
}
