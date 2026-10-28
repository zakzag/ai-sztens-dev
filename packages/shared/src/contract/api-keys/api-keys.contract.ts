/**
 * Registry entries of the `api-keys` resource (AIS-89).
 *
 * Every entry points at the schemas from `api-keys.schema.ts`, so the registry
 * can never describe a payload the server does not validate. Paths include the
 * global `api` prefix applied in `apps/api/src/main.ts`; the `:identifier`
 * placeholder is the Nest form and is converted to `{identifier}` when the
 * OpenAPI document is generated.
 */

import { API_KEYS_PATH, API_KEYS_IDENTIFIER_PARAM } from './api-keys.const.js';
import type { ApiEndpointContract } from '../endpoint.interface.js';
import {
  apiKeyListSchema,
  apiKeySchema,
  createApiKeySchema,
} from './api-keys.schema.js';

/** Path of the single-resource route, in Nest's `:param` notation. */
const IDENTIFIER_PATH = `${API_KEYS_PATH}/${API_KEYS_IDENTIFIER_PARAM}`;

/** All documented endpoints of the `api-keys` feature. */
export const API_KEYS_ENDPOINTS: readonly ApiEndpointContract[] = [
  {
    operationId: 'apiKeys.list',
    method: 'GET',
    path: API_KEYS_PATH,
    summary: 'List every stored API key, newest first',
    successStatus: 200,
    dataSchema: apiKeyListSchema,
    envelope: true,
  },
  {
    operationId: 'apiKeys.findByIdentifier',
    method: 'GET',
    path: IDENTIFIER_PATH,
    summary: 'Read one API key by its unique identifier',
    successStatus: 200,
    dataSchema: apiKeySchema,
    envelope: true,
  },
  {
    operationId: 'apiKeys.create',
    method: 'POST',
    path: API_KEYS_PATH,
    summary: 'Create an API key',
    successStatus: 201,
    dataSchema: apiKeySchema,
    requestSchema: createApiKeySchema,
    envelope: true,
  },
];
