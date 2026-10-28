/**
 * Registry entries of the `api-keys` resource (AIS-89).
 *
 * Every entry points at the schemas from `api-keys.schema.ts`, so the registry
 * can never describe a payload the server does not validate. Paths include the
 * global `api` prefix applied in `apps/api/src/main.ts`; the `:identifier`
 * placeholder is the Nest form and is converted to `{identifier}` when the
 * OpenAPI document is generated.
 *
 * `errors` lists the codes the route can actually answer with, **from the
 * catalogue** — the generated spec and the client mapping therefore share one
 * vocabulary. `tag` is the OpenAPI grouping (`api-keys`).
 */

import { API_KEYS_PATH, API_KEYS_IDENTIFIER_PARAM } from './api-keys.const.js';
import type { ApiEndpointContract } from '../endpoint.interface.js';
import { API_ERROR_CODE } from '../error-code.const.js';
import {
  apiKeyListSchema,
  apiKeySchema,
  createApiKeySchema,
} from './api-keys.schema.js';

/** Path of the single-resource route, in Nest's `:param` notation. */
const IDENTIFIER_PATH = `${API_KEYS_PATH}/${API_KEYS_IDENTIFIER_PARAM}`;

/** Failures every route can produce, regardless of what it does. */
const COMMON_ERRORS = [
  API_ERROR_CODE.INTERNAL_ERROR,
  API_ERROR_CODE.SERVICE_UNAVAILABLE,
] as const;

/** All documented endpoints of the `api-keys` feature. */
export const API_KEYS_ENDPOINTS: readonly ApiEndpointContract[] = [
  {
    operationId: 'apiKeys.list',
    method: 'GET',
    path: API_KEYS_PATH,
    summary: 'List every stored API key, newest first',
    tag: 'api-keys',
    successStatus: 200,
    dataSchema: apiKeyListSchema,
    errors: [...COMMON_ERRORS],
    envelope: true,
  },
  {
    operationId: 'apiKeys.findByIdentifier',
    method: 'GET',
    path: IDENTIFIER_PATH,
    summary: 'Read one API key by its unique identifier',
    tag: 'api-keys',
    successStatus: 200,
    dataSchema: apiKeySchema,
    errors: [API_ERROR_CODE.NOT_FOUND, ...COMMON_ERRORS],
    envelope: true,
  },
  {
    operationId: 'apiKeys.create',
    method: 'POST',
    path: API_KEYS_PATH,
    summary: 'Create an API key',
    tag: 'api-keys',
    successStatus: 201,
    dataSchema: apiKeySchema,
    requestSchema: createApiKeySchema,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
];
