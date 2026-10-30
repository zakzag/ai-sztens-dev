/**
 * `ApiKey` fixtures and the `ApiKeysService` double.
 *
 * `packages/api-client` is mocked out at the module boundary: the hooks are
 * tested against this double, so no test ever performs a request and the HTTP
 * layer keeps its own suite in `packages/api-client/test`.
 *
 * The double is a **singleton** (`API_KEYS_SERVICE_MOCK`) because `vi.mock`
 * factories are hoisted above the module imports: a factory can only reference
 * something that is either hoisted or imported dynamically. Tests configure it
 * through `resetApiKeysServiceMock()` (defaults) plus per-test overrides.
 */

import type { ApiKeysService } from '@callback/api-client';
import type { ApiKey, CreateApiKeyInput } from '@callback/shared';
import { vi, type Mock } from 'vitest';

/** One valid row, shaped exactly like the AIS-40 wire contract. */
export const API_KEY_FIXTURE: ApiKey = {
  id: '5d0f8f0e-9a2b-4c7e-8f3a-1b2c3d4e5f60',
  name: 'Vapi prod',
  identifier: 'vapi-prod',
  description: 'Production voice provider token',
  apiKey: 'sk-live-abcdef123456',
  expiresAt: '2027-01-31T23:00:00.000Z',
  createdAt: '2026-10-21T15:00:00.000Z',
  updatedAt: '2026-10-21T15:00:00.000Z',
};

/** A second row without description and expiry, so both branches are covered. */
export const SECOND_API_KEY_FIXTURE: ApiKey = {
  id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  name: 'Vapi dev',
  identifier: 'vapi-dev',
  description: null,
  apiKey: 'sk-test-987654',
  expiresAt: null,
  createdAt: '2026-10-20T09:30:00.000Z',
  updatedAt: '2026-10-20T09:30:00.000Z',
};

/** Full `GET /api/api-keys` payload (newest first). */
export const API_KEY_FIXTURES: readonly ApiKey[] = [
  API_KEY_FIXTURE,
  SECOND_API_KEY_FIXTURE,
];

/** A minimal, valid create payload. */
export const CREATE_API_KEY_INPUT_FIXTURE: CreateApiKeyInput = {
  name: 'Vapi staging',
  identifier: 'vapi-staging',
  apiKey: 'sk-stage-42',
};

/** What the backend echoes back for {@link CREATE_API_KEY_INPUT_FIXTURE}. */
export const CREATED_API_KEY_FIXTURE: ApiKey = {
  ...API_KEY_FIXTURE,
  name: CREATE_API_KEY_INPUT_FIXTURE.name,
  identifier: CREATE_API_KEY_INPUT_FIXTURE.identifier,
  apiKey: CREATE_API_KEY_INPUT_FIXTURE.apiKey,
  description: null,
  expiresAt: null,
};

/** The double plus typed handles on its methods, for assertions. */
export interface ApiKeysServiceMock {
  /** `ApiKeysService` implementation handed to the mocked module. */
  readonly service: ApiKeysService;
  /** `GET` double. */
  readonly listMock: Mock<() => Promise<readonly ApiKey[]>>;
  /** `POST` double. */
  readonly createMock: Mock<(input: CreateApiKeyInput) => Promise<ApiKey>>;
}

/**
 * @returns a fresh service double resolving with the fixtures.
 */
export function createApiKeysServiceMock(): ApiKeysServiceMock {
  const listMock = vi.fn<() => Promise<readonly ApiKey[]>>();
  const createMock = vi.fn<(input: CreateApiKeyInput) => Promise<ApiKey>>();

  return {
    service: { list: listMock, create: createMock },
    listMock,
    createMock,
  };
}

/** Shared double bound to the mocked `services/api-client` module. */
export const API_KEYS_SERVICE_MOCK: ApiKeysServiceMock =
  createApiKeysServiceMock();

/**
 * Restores the default, non-error behaviour of the shared double.
 *
 * Call it from `beforeEach`: it clears the recorded calls *and* re-installs the
 * resolving implementations, so a `mockRejectedValueOnce` from a previous test
 * cannot leak into the next one.
 */
export function resetApiKeysServiceMock(): void {
  API_KEYS_SERVICE_MOCK.listMock.mockReset();
  API_KEYS_SERVICE_MOCK.listMock.mockResolvedValue(API_KEY_FIXTURES);

  API_KEYS_SERVICE_MOCK.createMock.mockReset();
  API_KEYS_SERVICE_MOCK.createMock.mockResolvedValue(CREATED_API_KEY_FIXTURE);
}
