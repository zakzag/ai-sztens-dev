/**
 * Implementation of {@link ApiKeysService}.
 *
 * The service contains no logic of its own: it names the endpoints, binds them to
 * the shared zod schemas and passes the caller's options through. Validation of
 * the payload is the backend's job (and the form's, for UX); parsing of the
 * *response* is this layer's, so a contract drift surfaces here instead of inside
 * a component.
 *
 * `list` goes through `getList` and not `get`: the pager block (`meta.pagination`)
 * only exists on the list response, and dropping it here would make it
 * unobservable for every consumer above — the generic hook layer (AIS-114) reads
 * exactly that block.
 *
 * `update` and `remove` (AIS-110) are the two mutation verbs the registry
 * publishes but nothing consumed yet. Both address the **same** detail route as
 * `findByIdentifier`, so they reuse `toApiKeyDetailPath` instead of declaring a
 * second path constant: one route, one place that knows how `:identifier` looks.
 */

import {
  apiKeyListSchema,
  apiKeySchema,
  noPayloadSchema,
  type ApiKey,
  type ApiKeyListQuery,
  type ApiResult,
  type CreateApiKeyInput,
  type UpdateApiKeyInput,
} from '@callback/shared';
import {
  API_KEYS_PATH,
  API_KEY_LIST_QUERY_DEFAULTS,
} from './api-keys.const.js';
import type { ApiKeysService } from './api-keys.interface.js';
import { toApiKeyDetailPath } from './api-keys.path.js';
import type { HttpClient, RequestOptions } from '../http-client.interface.js';

/**
 * Creates the service on top of an injected transport.
 *
 * @param client - HTTP transport (base URL and token supplier already bound).
 * @returns the service consumed by the query hooks.
 */
export function createApiKeysService(client: HttpClient): ApiKeysService {
  return {
    list: async (
      query: ApiKeyListQuery,
      options?: RequestOptions,
    ): Promise<ApiResult<readonly ApiKey[]>> =>
      client.getList(
        API_KEYS_PATH,
        apiKeyListSchema,
        { query, defaults: API_KEY_LIST_QUERY_DEFAULTS },
        options,
      ),

    findByIdentifier: async (
      identifier: string,
      options?: RequestOptions,
    ): Promise<ApiKey> =>
      client.get(toApiKeyDetailPath(identifier), apiKeySchema, options),

    create: async (
      input: CreateApiKeyInput,
      options?: RequestOptions,
    ): Promise<ApiKey> =>
      client.post(API_KEYS_PATH, input, apiKeySchema, options),

    // `PATCH`, not `PUT`: the convention is a partial update guarded by
    // `updatedAt`, and the transport validates the response with the same schema
    // as the reads, so a drift in the updated row surfaces here.
    update: async (
      identifier: string,
      input: UpdateApiKeyInput,
      options?: RequestOptions,
    ): Promise<ApiKey> =>
      client.patch(
        toApiKeyDetailPath(identifier),
        input,
        apiKeySchema,
        options,
      ),

    // `noPayloadSchema` is `z.null()`: the transport re-validates `data` with the
    // bare schema, so a `204`, a missing `data` key or an object payload is a
    // contract violation instead of a silent success.
    remove: async (
      identifier: string,
      options?: RequestOptions,
    ): Promise<null> =>
      client.delete(toApiKeyDetailPath(identifier), noPayloadSchema, options),
  };
}
