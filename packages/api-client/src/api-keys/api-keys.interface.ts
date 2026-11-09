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
 * The write methods (AIS-110) follow the mutation convention of
 * `docs/Specs/API-Convention.md` §4.2:
 *
 * - `update` sends only the fields that change plus the **required** `updatedAt`
 *   concurrency token, so a stale edit can never silently overwrite a newer one;
 * - `remove` is a soft delete that answers `200` with `data: null` — never `204`
 *   — so the envelope (and `meta.requestId`) survives. `null` is therefore the
 *   honest return type, not `void`.
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
  UpdateApiKeyInput,
} from '@callback/shared';
import type { RequestOptions } from '../http-client.interface.js';

/** Reads, creates, updates and soft-deletes API keys through the backend. */
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

  /**
   * `PATCH /api/api-keys/:identifier` — partial, version-guarded update.
   *
   * `undefined` means “leave the value alone”, `null` means “clear it”, and
   * `updatedAt` is the version the caller last read. A stale version is a
   * `409 STALE_WRITE` with `issues[].path === 'updatedAt'`, so the caller can
   * re-read and retry instead of overwriting someone else's change.
   *
   * @param identifier - unique, URL-safe key of the resource.
   * @param input - the changed fields plus the required `updatedAt` token.
   * @param options - optional abort signal / extra headers.
   */
  update(
    identifier: string,
    input: UpdateApiKeyInput,
    options?: RequestOptions,
  ): Promise<ApiKey>;

  /**
   * `DELETE /api/api-keys/:identifier` — soft delete; the row disappears from
   * every read.
   *
   * There is no body parameter: the convention has no body-carrying delete. The
   * resolved value is `null` because the success envelope carries `data: null`
   * (§4.2.2); the transport still validates that shape, so a `204` or a
   * non-`null` payload is a contract violation instead of a silent success.
   *
   * @param identifier - unique, URL-safe key of the resource.
   * @param options - optional abort signal / extra headers.
   */
  remove(identifier: string, options?: RequestOptions): Promise<null>;
}
