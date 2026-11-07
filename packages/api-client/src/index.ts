export {
  API_ERROR_CODE,
  API_ERROR_NAME,
  HTTP_STATUS,
  NETWORK_ERROR_MESSAGE,
  UNEXPECTED_PAYLOAD_CODE,
  UNEXPECTED_PAYLOAD_MESSAGE,
  UNPARSEABLE_ERROR_MESSAGE,
} from './api-error.const.js';

export type { ApiErrorCode } from './api-error.const.js';

export {
  ApiError,
  extractErrorDetails,
  formatIssueLine,
  isConflict,
  isNetworkError,
  isNotFoundError,
  isValidationError,
  parseErrorBody,
  toFailureMessage,
} from './api-error.js';

export {
  toIssueDetails,
  toPayloadRelativePath,
  unwrapEnvelope,
} from './envelope.logic.js';

export type {
  EnvelopeUnwrapFailure,
  EnvelopeUnwrapResult,
  EnvelopeUnwrapSuccess,
} from './envelope.logic.interface.js';

export type {
  ApiErrorBody,
  ApiErrorEnvelopeBody,
  ApiErrorInit,
  ParsedErrorBody,
} from './api-error.interface.js';

export { createHttpClient, joinUrl } from './http-client.js';

export {
  InvalidEndpointPathError,
  UnknownEndpointError,
  UnresolvedPathParameterError,
  assertNoUnresolvedPathParameter,
  clientPathOf,
  hasUnresolvedPathParameter,
  toClientPath,
} from './endpoint-path.js';

export type {
  AttemptOutcome,
  AttemptRequest,
  HttpClient,
  HttpClientConfig,
  HttpEvent,
  HttpEventResponseMeta,
  ListRequest,
  RequestOptions,
} from './http-client.interface.js';

export { toQueryString } from './query-string.logic.js';

export type {
  QueryDefaults,
  QueryFilters,
  QueryScalar,
  QueryValue,
} from './query-string.interface.js';

export { unwrapPaginatedEnvelope } from './paginated-envelope.logic.js';

export type {
  PaginatedUnwrapResult,
  PaginatedUnwrapSuccess,
} from './paginated-envelope.logic.interface.js';

export {
  API_KEYS_DETAIL_PATH,
  API_KEYS_PATH,
  API_KEY_LIST_QUERY_DEFAULTS,
} from './api-keys/api-keys.const.js';

export { toApiKeyDetailPath } from './api-keys/api-keys.path.js';

export { createApiKeysService } from './api-keys/api-keys.service.js';

export type { ApiKeysService } from './api-keys/api-keys.interface.js';
