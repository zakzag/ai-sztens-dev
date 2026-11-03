/**
 * Public API of `@callback/shared`.
 *
 * Two groups, nothing else:
 *
 * - `lib/` — framework-free helpers (build-info formatting);
 * - `contract/` — the HTTP contract: envelope schemas and factories, the error
 *   code catalogue, the shared HTTP statuses and the resource schemas.
 *
 * Re-exports are explicit (no `export *`) so the package's surface stays
 * greppable and a rename can never silently widen it.
 */

export {
  UNKNOWN_BUILD_VALUE,
  formatCommitHash,
  formatDeployDate,
  normalizeBuildValue,
} from './lib/build-info.js';

export { HTTP_STATUS } from './contract/http-status.const.js';
export type { HttpStatus } from './contract/http-status.const.js';

export {
  API_GLOBAL_PREFIX,
  API_PATH_PREFIX,
} from './contract/api-prefix.const.js';

export {
  API_ERROR_CODE,
  API_ERROR_CODE_STATUS,
  UNKNOWN_API_ERROR_CODE_STATUS,
} from './contract/error-code.const.js';
export type { ApiErrorCode } from './contract/error-code.const.js';

export { isoDateTimeSchema } from './contract/datetime.schema.js';

export {
  paginationMetaSchema,
  responseMetaSchema,
  successEnvelopeSchema,
  toSuccessEnvelope,
} from './contract/envelope.schema.js';
export type {
  ApiEnvelope,
  PaginationMeta,
  ResponseMeta,
} from './contract/envelope.interface.js';

export {
  LIST_QUERY_DEFAULT_LIMIT,
  LIST_QUERY_DEFAULT_ORDER,
  LIST_QUERY_DEFAULT_PAGE,
  LIST_QUERY_MAX_LIMIT,
  LIST_QUERY_MAX_SEARCH_LENGTH,
  LIST_QUERY_ORDER_VALUES,
  createListQuerySchema,
  listQueryLimitSchema,
  listQueryOrderSchema,
  listQueryPageSchema,
  listQuerySchema,
  listQuerySearchSchema,
} from './contract/list-query.schema.js';
export type {
  ListQuery,
  ListQueryOrder,
} from './contract/list-query.schema.js';

export {
  LIST_QUERY_LIMIT_PARAMETER,
  LIST_QUERY_ORDER_PARAMETER,
  LIST_QUERY_PAGE_PARAMETER,
  LIST_QUERY_PARAMETERS,
  LIST_QUERY_SEARCH_PARAMETER,
} from './contract/list-query.parameters.js';

export {
  LIST_QUERY_DEFAULTS,
  mergeListQuery,
  toListQueryParams,
  toPaginationMeta,
} from './contract/list-query.helper.js';
export type { ListQueryDefaults } from './contract/list-query.helper.js';

export { paginatedSchema } from './contract/paginated.schema.js';

export { noPayloadSchema } from './contract/no-payload.schema.js';

export type { ApiResult } from './contract/api-result.interface.js';

export {
  apiErrorBodySchema,
  apiErrorDetailSchema,
  apiErrorEnvelopeSchema,
  resolveApiErrorStatus,
  toErrorEnvelope,
} from './contract/error-envelope.js';
export type {
  ApiErrorBody,
  ApiErrorDetail,
  ApiErrorEnvelope,
  AppErrorShape,
  ErrorContext,
} from './contract/error-envelope.interface.js';

export type {
  ApiEndpointContract,
  ApiHttpMethod,
  ApiQueryParameterContract,
} from './contract/endpoint.interface.js';

export type { RequestBodyOf } from './contract/endpoint.body.js';

export { API_KEYS_ENDPOINTS } from './contract/api-keys/api-keys.contract.js';

export {
  API_ENDPOINTS,
  ENVELOPE_EXEMPTIONS,
  findEndpoint,
} from './contract/endpoint.registry.js';
export type { EnvelopeExemption } from './contract/endpoint.registry.js';

export {
  API_KEYS_IDENTIFIER_PARAM,
  API_KEYS_PATH,
  API_KEY_DESCRIPTION_MAX_LENGTH,
  API_KEY_IDENTIFIER_MAX_LENGTH,
  API_KEY_IDENTIFIER_PATTERN,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_VALUE_MAX_LENGTH,
} from './contract/api-keys/api-keys.const.js';

export {
  API_KEY_DEFAULT_SORT,
  API_KEY_LIST_QUERY_PARAMETERS,
  API_KEY_SORT_FIELDS,
  API_KEY_SORT_PARAMETER,
  apiKeyListQuerySchema,
} from './contract/api-keys/api-keys.list-query.js';
export type {
  ApiKeyListQuery,
  ApiKeySortField,
} from './contract/api-keys/api-keys.list-query.js';

export {
  FILLED_API_KEY,
  SECOND_API_KEY,
  VALID_API_KEY,
  VALID_API_KEY_LIST,
  VALID_API_KEY_PAIR,
  VALID_UPDATE_API_KEY_REQUEST,
} from './contract/api-keys/api-keys.fixture.js';

export {
  API_KEY_IDENTIFIER_MESSAGE,
  apiKeyIdentifierSchema,
  apiKeyListSchema,
  apiKeySchema,
  createApiKeySchema,
} from './contract/api-keys/api-keys.schema.js';

export {
  API_KEY_UPDATE_FORBIDDEN_FIELDS,
  updateApiKeySchema,
} from './contract/api-keys/api-keys.update.js';

export type {
  ApiKey,
  CreateApiKeyInput,
  UpdateApiKeyInput,
} from './contract/api-keys/api-keys.interface.js';
