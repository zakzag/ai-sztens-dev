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
} from './contract/endpoint.interface.js';

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
  API_KEY_IDENTIFIER_MESSAGE,
  apiKeyIdentifierSchema,
  apiKeyListSchema,
  apiKeySchema,
  createApiKeySchema,
} from './contract/api-keys/api-keys.schema.js';

export type {
  ApiKey,
  CreateApiKeyInput,
} from './contract/api-keys/api-keys.interface.js';
