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

export {
  ACTIVITY_AUTHOR_NAME_MAX_LENGTH,
  ACTIVITY_BODY_MAX_LENGTH,
  AUDIT_IP_ADDRESS_MAX_LENGTH,
  AUDIT_REQUEST_ID_MAX_LENGTH,
  AUDIT_USER_AGENT_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_POSITION_MAX_LENGTH,
  CUSTOMERS_CONTACT_ID_PARAM,
  CUSTOMERS_ID_PARAM,
  CUSTOMERS_PATH,
  CUSTOMER_ADDRESS_CITY_MAX_LENGTH,
  CUSTOMER_ADDRESS_LINE_MAX_LENGTH,
  CUSTOMER_COUNTRY_PATTERN,
  CUSTOMER_DEFAULT_COUNTRY,
  CUSTOMER_DEFAULT_SORT,
  CUSTOMER_EU_VAT_NUMBER_MAX_LENGTH,
  CUSTOMER_INDUSTRY_MAX_LENGTH,
  CUSTOMER_INITIAL_STATUS,
  CUSTOMER_LEGAL_FORM_MAX_LENGTH,
  CUSTOMER_LEGAL_NAME_MAX_LENGTH,
  CUSTOMER_NUMBER_MAX_LENGTH,
  CUSTOMER_NUMBER_PATTERN,
  CUSTOMER_REGISTRATION_NUMBER_MAX_LENGTH,
  CUSTOMER_SHORT_NAME_MAX_LENGTH,
  CUSTOMER_SORT_FIELDS,
  CUSTOMER_TAG_NAME_MAX_LENGTH,
  CUSTOMER_USER_NAME_MAX_LENGTH,
} from './contract/customers/customers.const.js';
export type { CustomerSortField } from './contract/customers/customers.const.js';

export {
  ACTIVITY_TYPE_VALUES,
  AUDIT_OPERATION_VALUES,
  AUDIT_SOURCE_VALUES,
  AUTHOR_TYPE_VALUES,
  CONTACT_ROLE_VALUES,
  CUSTOMER_SOURCE_VALUES,
  CUSTOMER_STATUS_VALUES,
  CUSTOMER_TYPE_VALUES,
  CUSTOMER_USER_ROLE_VALUES,
  CUSTOMER_USER_STATUS_VALUES,
  HEADCOUNT_RANGE_VALUES,
  OPERATOR_ROLE_VALUES,
  activityTypeSchema,
  auditOperationSchema,
  auditSourceSchema,
  authorTypeSchema,
  contactRoleSchema,
  customerSourceSchema,
  customerStatusSchema,
  customerTypeSchema,
  customerUserRoleSchema,
  customerUserStatusSchema,
  headcountRangeSchema,
  operatorRoleSchema,
} from './contract/customers/customers.enums.js';
export type {
  ActivityType,
  AuditOperation,
  AuditSource,
  AuthorType,
  ContactRole,
  CustomerSource,
  CustomerStatus,
  CustomerType,
  CustomerUserRole,
  CustomerUserStatus,
  HeadcountRange,
  OperatorRole,
} from './contract/customers/customers.enums.js';

export {
  CUSTOMER_UPDATE_FORBIDDEN_FIELDS,
  activitySchema,
  attachCustomerTagSchema,
  auditLogSchema,
  contactIdSchema,
  contactListSchema,
  contactSchema,
  createActivitySchema,
  createContactSchema,
  createCustomerSchema,
  createCustomerTagSchema,
  customerCountrySchema,
  customerDetailSchema,
  customerIdSchema,
  customerListSchema,
  customerNumberSchema,
  customerSchema,
  customerTagSchema,
  customerUserSchema,
  inviteCustomerUserSchema,
  updateActivitySchema,
  updateContactSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
} from './contract/customers/customers.schema.js';

export {
  CUSTOMER_LIST_QUERY_PARAMETERS,
  CUSTOMER_RESPONSIBLE_OPERATOR_PARAMETER,
  CUSTOMER_SORT_PARAMETER,
  CUSTOMER_SOURCE_PARAMETER,
  CUSTOMER_STATUS_PARAMETER,
  CUSTOMER_TYPE_PARAMETER,
  customerListQuerySchema,
} from './contract/customers/customers.list-query.js';
export type { CustomerListQuery } from './contract/customers/customers.list-query.js';

export {
  INVITED_CUSTOMER_USER,
  SECOND_CONTACT,
  SECOND_CUSTOMER,
  SYSTEM_ACTIVITY,
  VALID_ACTIVITY,
  VALID_AUDIT_LOG,
  VALID_CONTACT,
  VALID_CONTACT_LIST,
  VALID_CREATE_CONTACT_REQUEST,
  VALID_CREATE_CUSTOMER_REQUEST,
  VALID_CUSTOMER,
  VALID_CUSTOMER_DETAIL,
  VALID_CUSTOMER_LIST,
  VALID_CUSTOMER_TAG,
  VALID_CUSTOMER_USER,
  VALID_UPDATE_CONTACT_REQUEST,
  VALID_UPDATE_CUSTOMER_REQUEST,
} from './contract/customers/customers.fixture.js';

export type {
  Activity,
  AttachCustomerTagInput,
  AuditLog,
  Contact,
  CreateActivityInput,
  CreateContactInput,
  CreateCustomerInput,
  CreateCustomerTagInput,
  Customer,
  CustomerDetail,
  CustomerTag,
  CustomerUser,
  InviteCustomerUserInput,
  UpdateActivityInput,
  UpdateContactInput,
  UpdateCustomerInput,
  UpdateCustomerStatusInput,
} from './contract/customers/customers.interface.js';

export {
  ALLOWED_URL_PROTOCOLS,
  DATE_ONLY_LENGTH,
  DATE_ONLY_PATTERN,
  EMAIL_MAX_LENGTH,
  HU_POSTAL_CODE_LENGTH,
  HU_POSTAL_CODE_PATTERN,
  HU_TAX_NUMBER_AREA_CODE_MAX,
  HU_TAX_NUMBER_AREA_CODE_MIN,
  HU_TAX_NUMBER_CHECK_DIGIT_WEIGHTS,
  HU_TAX_NUMBER_MAX_LENGTH,
  HU_TAX_NUMBER_PATTERN,
  HU_TAX_NUMBER_VAT_CODE_MAX,
  HU_TAX_NUMBER_VAT_CODE_MIN,
  IBAN_LETTER_OFFSET,
  IBAN_MAX_LENGTH,
  IBAN_MIN_LENGTH,
  IBAN_MODULUS,
  IBAN_PATTERN,
  IBAN_VALID_REMAINDER,
  LONG_TEXT_MAX_LENGTH,
  PHONE_DEFAULT_COUNTRY,
  PHONE_INPUT_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  URL_MAX_LENGTH,
} from './contract/common/format.const.js';

export type {
  IdentifierSchemaOptions,
  TextSchemaOptions,
} from './contract/common/format-schema.interface.js';

export type { DateOnlyParts } from './contract/common/date-only.interface.js';
export type { HuTaxNumberParts } from './contract/common/hu-tax-number.interface.js';

export { formatMessage, resolveMessage } from './contract/common/validation-message.helper.js';
export {
  configureValidationLocale,
  getValidationLocale,
  resetValidationLocale,
} from './contract/common/validation-message.helper.js';
export { VALIDATION_MESSAGE_CATALOGUE } from './contract/common/validation-message.const.js';
export type {
  ValidationLocale,
  ValidationMessageCatalogue,
  ValidationMessageKey,
  ValidationMessageParams,
} from './contract/common/validation-message.interface.js';
export { VALIDATION_ERROR_MAP } from './contract/common/validation-error-map.const.js';

export { isValidDateOnly, parseDateOnly } from './contract/common/date-only.helper.js';
export { dateOnlySchema } from './contract/common/date-only.schema.js';
export { emailSchema } from './contract/common/email.schema.js';
export { huPostalCodeSchema } from './contract/common/hu-postal-code.schema.js';
export {
  computeHuTaxNumberCheckDigit,
  hasValidHuTaxNumberCheckDigit,
  isValidHuTaxNumber,
  parseHuTaxNumber,
} from './contract/common/hu-tax-number.helper.js';
export { huTaxNumberSchema } from './contract/common/hu-tax-number.schema.js';
export {
  computeIbanRemainder,
  isValidIban,
  normalizeIban,
  toIbanNumeric,
} from './contract/common/iban.helper.js';
export { ibanSchema } from './contract/common/iban.schema.js';
export { isValidPhone, normalizePhone } from './contract/common/phone.helper.js';
export { phoneSchema } from './contract/common/phone.schema.js';
export {
  identifierSchema,
  nonEmptyTextSchema,
  trimmedStringSchema,
} from './contract/common/text.schema.js';
export { urlSchema } from './contract/common/url.schema.js';

export {
  dateOnlyToLocalIsoInstant,
  toLocalDateOnly,
} from './lib/date-only.js';
