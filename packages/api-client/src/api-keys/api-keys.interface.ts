/**
 * Contract of the `api-keys` service.
 *
 * The interface is what React hooks depend on; the implementation
 * ({@link createApiKeysService}) is only referenced by the composition root.
 * That keeps every consumer testable with a plain object double.
 */

import type { ApiKey, CreateApiKeyInput } from '@callback/shared';

/** Reads and creates API keys through the backend. */
export interface ApiKeysService {
  /** `GET /api/api-keys` — every stored key, newest first. */
  list(): Promise<readonly ApiKey[]>;
  /** `POST /api/api-keys` — persists a new key and returns the created row. */
  create(input: CreateApiKeyInput): Promise<ApiKey>;
}
