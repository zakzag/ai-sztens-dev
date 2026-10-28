/**
 * The HTTP contract — the **single** place where a request or response shape is
 * written down (D6 of the API convention plan).
 *
 * Everything a server controller, a client transport or a test needs comes from
 * here. Exports are explicit (no `export *`) so that “what the contract is” can
 * be read from one screen, and each re-export keeps the JSDoc of its
 * declaration.
 */

export { HTTP_STATUS } from './http-status.const.js';
export type { HttpStatus } from './http-status.const.js';

export {
  API_ERROR_CODE,
  API_ERROR_CODE_STATUS,
  UNKNOWN_API_ERROR_CODE_STATUS,
} from './error-code.const.js';
export type { ApiErrorCode } from './error-code.const.js';

export { isoDateTimeSchema } from './datetime.schema.js';

export {
  paginationMetaSchema,
  responseMetaSchema,
  successEnvelopeSchema,
  toSuccessEnvelope,
} from './envelope.schema.js';
export type {
  ApiEnvelope,
  PaginationMeta,
  ResponseMeta,
} from './envelope.interface.js';

export {
  apiErrorBodySchema,
  apiErrorDetailSchema,
  apiErrorEnvelopeSchema,
  resolveApiErrorStatus,
  toErrorEnvelope,
} from './error-envelope.js';
export type {
  ApiErrorBody,
  ApiErrorDetail,
  ApiErrorEnvelope,
  AppErrorShape,
  ErrorContext,
} from './error-envelope.interface.js';

export type {
  ApiEndpointContract,
  ApiHttpMethod,
} from './endpoint.interface.js';

export { API_KEYS_ENDPOINTS } from './api-keys/api-keys.contract.js';

export {
  API_ENDPOINTS,
  ENVELOPE_EXEMPTIONS,
  findEndpoint,
} from './endpoint.registry.js';
export type { EnvelopeExemption } from './endpoint.registry.js';

export {
  API_KEYS_IDENTIFIER_PARAM,
  API_KEYS_PATH,
  API_KEY_DESCRIPTION_MAX_LENGTH,
  API_KEY_IDENTIFIER_MAX_LENGTH,
  API_KEY_IDENTIFIER_PATTERN,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_VALUE_MAX_LENGTH,
} from './api-keys/api-keys.const.js';

export {
  API_KEY_IDENTIFIER_MESSAGE,
  apiKeyIdentifierSchema,
  apiKeyListSchema,
  apiKeySchema,
  createApiKeySchema,
} from './api-keys/api-keys.schema.js';

export type {
  ApiKey,
  CreateApiKeyInput,
} from './api-keys/api-keys.interface.js';
