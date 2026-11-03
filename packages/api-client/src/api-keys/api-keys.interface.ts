/**
 * Contract of the `api-keys` service.
 *
 * The interface is what React hooks depend on; the implementation
 * ({@link createApiKeysService}) is only referenced by the composition root.
 * That keeps every consumer testable with a plain object double.
 *
 * The read methods follow the transport convention (AIS-109):
 *
 * - `list` returns the shared `ApiResult`, because a paginated list is the only
 *   call where the pager block is meaningful — `meta.pagination` is what the
 *   generic hook layer (AIS-114) hands to the UI;
 * - `findByIdentifier` returns the payload, because a single resource never
 *   needs a pager.
 *
 * Every method accepts optional {@link RequestOptions} so the caller can pass an
 * abort `signal` (a TanStack Query cancellation) without the service having to
 * know about React.
 */

import type {
  ApiKey,
  ApiKeyListQuery,
  ApiResult,
  CreateApiKeyInput,
} from '@callback/shared';
import type { RequestOptions } from '../http-client.interface.js';

/** Reads, creates and looks up API keys through the backend. */
export interface ApiKeysService {
  /**
   * `GET /api/api-keys` — one page of stored keys, plus `meta.pagination`.
   *
   * @param query - validated list query (`page`, `limit`, `sort`, `order`, `q`).
   * @param options - optional abort signal / extra headers.
   */
  list(
    query: ApiKeyListQuery,
    options?: RequestOptions,
  ): Promise<ApiResult<readonly ApiKey[]>>;

  /**
   * `GET /api/api-keys/:identifier` — one key, or a `404` envelope.
   *
   * @param identifier - unique, URL-safe key of the resource.
   * @param options - optional abort signal / extra headers.
   */
  findByIdentifier(
    identifier: string,
    options?: RequestOptions,
  ): Promise<ApiKey>;

  /**
   * `POST /api/api-keys` — persists a new key and returns the created row.
   *
   * @param input - the create payload.
   * @param options - optional abort signal / extra headers.
   */
  create(input: CreateApiKeyInput, options?: RequestOptions): Promise<ApiKey>;
}
