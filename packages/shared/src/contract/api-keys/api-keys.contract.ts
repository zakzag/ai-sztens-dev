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
import { noPayloadSchema } from '../no-payload.schema.js';
import { API_KEY_LIST_QUERY_PARAMETERS } from './api-keys.list-query.js';
import {
  VALID_API_KEY,
  VALID_API_KEY_LIST,
  VALID_UPDATE_API_KEY_REQUEST,
} from './api-keys.fixture.js';
import {
  apiKeyListSchema,
  apiKeySchema,
  createApiKeySchema,
} from './api-keys.schema.js';
import { updateApiKeySchema } from './api-keys.update.js';

/** Path of the single-resource route, in Nest's `:param` notation. */
const IDENTIFIER_PATH = `${API_KEYS_PATH}/${API_KEYS_IDENTIFIER_PARAM}`;

/** Failures every route can produce, regardless of what it does. */
const COMMON_ERRORS = [
  API_ERROR_CODE.INTERNAL_ERROR,
  API_ERROR_CODE.SERVICE_UNAVAILABLE,
] as const;

/**
 * Sample `meta.pagination` of the list endpoint.
 *
 * One key, one page: the smallest honest example. A bigger number would make
 * the published body look as if the table always holds more than it does.
 */
const LIST_EXAMPLE_PAGINATION = {
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
} as const;

/**
 * All documented endpoints of the `api-keys` feature.
 *
 * The `as const satisfies` pair matters (AIS-109): `satisfies` proves the array
 * is still a valid endpoint list, while `as const` keeps the **literal** type of
 * every entry — including the concrete zod type of `requestSchema`. Without it
 * the annotation would widen `requestSchema` to `z.ZodTypeAny`, and
 * {@link RequestBodyOf} could not derive a request-body type from the registry.
 */
export const API_KEYS_ENDPOINTS = [
  {
    operationId: 'apiKeys.list',
    method: 'GET',
    path: API_KEYS_PATH,
    summary:
      'List stored API keys, paginated and sorted, newest first by default',
    tag: 'api-keys',
    successStatus: 200,
    dataSchema: apiKeyListSchema,
    example: VALID_API_KEY_LIST,
    queryParameters: API_KEY_LIST_QUERY_PARAMETERS,
    examplePagination: LIST_EXAMPLE_PAGINATION,
    errors: [API_ERROR_CODE.VALIDATION_FAILED, ...COMMON_ERRORS],
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
    example: VALID_API_KEY,
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
    example: VALID_API_KEY,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'apiKeys.update',
    method: 'PATCH',
    path: IDENTIFIER_PATH,
    summary: 'Update an API key (partial, guarded by the last known updatedAt)',
    tag: 'api-keys',
    successStatus: 200,
    dataSchema: apiKeySchema,
    requestSchema: updateApiKeySchema,
    example: VALID_API_KEY,
    errors: [
      API_ERROR_CODE.VALIDATION_FAILED,
      API_ERROR_CODE.NOT_FOUND,
      API_ERROR_CODE.STALE_WRITE,
      API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED,
      ...COMMON_ERRORS,
    ],
    envelope: true,
  },
  {
    operationId: 'apiKeys.remove',
    method: 'DELETE',
    path: IDENTIFIER_PATH,
    summary: 'Soft-delete an API key; the row disappears from every read',
    tag: 'api-keys',
    successStatus: 200,
    dataSchema: noPayloadSchema,
    // `null` is the published sample: a `DELETE` has nothing to return, and the
    // envelope still carries `meta.requestId`.
    example: null,
    errors: [API_ERROR_CODE.NOT_FOUND, ...COMMON_ERRORS],
    envelope: true,
  },
] as const satisfies readonly ApiEndpointContract[];
