/**
 * MSW handlers of the `api-keys` resource.
 *
 * The mock point is the network, not the service (decision **D1**): a test lets
 * the real `apiKeysService` + `httpClient` run and only replaces the wire. The
 * success bodies come from the shared contract fixtures (`@callback/shared`), so
 * the same data feeds the OpenAPI examples, the contract tests and these
 * handlers — one value, many consumers.
 *
 * Handlers are exported individually so a test can `server.use(...)` exactly the
 * one scenario it needs; `apiKeysHandlers` is the default set registered by the
 * global server.
 */

import { delay, http, HttpResponse } from 'msw';
import type {
  ApiKey,
  CreateApiKeyInput,
  PaginationMeta,
} from '@callback/shared';
import {
  API_ERROR_CODE,
  API_KEYS_PATH,
  SECOND_API_KEY,
  VALID_API_KEY,
  VALID_API_KEY_PAIR,
  toPaginationMeta,
} from '@callback/shared';
import { errorResponse, successResponse } from './handler-envelope.js';

/** Developer text of a duplicate-identifier response (for logs only). */
const CONFLICT_DETAIL = 'identifier must be unique';

/** Developer text of a rejected payload (for logs only). */
const VALIDATION_DETAIL = 'identifier must match /^[A-Za-z0-9._-]+$/';

/**
 * Builds the echo the server sends for a successful create: the submitted
 * fields plus the identity it owns.
 *
 * @param input - the create payload sent by the client.
 * @returns the stored `ApiKey`, with the optional fields normalised to `null`.
 */
function createdApiKey(input: CreateApiKeyInput): ApiKey {
  return {
    id: '5d0f8f0e-9a2b-4c7e-8f3a-1b2c3d4e5f60',
    name: input.name,
    identifier: input.identifier,
    description: input.description ?? null,
    apiKey: input.apiKey,
    expiresAt: input.expiresAt ?? null,
    createdAt: '2026-11-02T14:00:00.000Z',
    updatedAt: '2026-11-02T14:00:00.000Z',
  };
}

/** Path template of the single-resource route, as MSW matches it. */
export const API_KEYS_DETAIL_PATH_PATTERN = `${API_KEYS_PATH}/:identifier`;

/**
 * Pagination block of the default list response.
 *
 * Both fixture rows fit on one page, so `totalPages` is `1` — the value a pager
 * would render. Handlers that answer a *slice* of the data set compute their own
 * block instead.
 */
const DEFAULT_LIST_PAGINATION: PaginationMeta = toPaginationMeta(
  { page: 1, limit: 20 },
  VALID_API_KEY_PAIR.length,
);

/** `200` list with one filled and one empty-value row. */
export const apiKeysListSuccess = http.get(API_KEYS_PATH, () =>
  successResponse(VALID_API_KEY_PAIR, { pagination: DEFAULT_LIST_PAGINATION }),
);

/** `200` empty list — `totalPages` is `0`, never `1`. */
export const apiKeysListEmpty = http.get(API_KEYS_PATH, () =>
  successResponse([], {
    pagination: toPaginationMeta({ page: 1, limit: 20 }, 0),
  }),
);

/** `200` second page of a two-page result set (one row per page). */
export const apiKeysListPageTwo = http.get(API_KEYS_PATH, () =>
  successResponse([SECOND_API_KEY], {
    pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
  }),
);

/** `200` detail of the first fixture key. */
export const apiKeysDetailSuccess = http.get(API_KEYS_DETAIL_PATH_PATTERN, () =>
  successResponse(VALID_API_KEY),
);

/** `404` for an identifier that is not stored. */
export const apiKeysDetailNotFound = http.get(
  API_KEYS_DETAIL_PATH_PATTERN,
  () =>
    errorResponse(API_ERROR_CODE.NOT_FOUND, 'API key was not found', {
      path: `${API_KEYS_PATH}/ghost`,
    }),
);

/** `500` list failure with a correlation id the log tier can assert. */
export const apiKeysListServerError = http.get(API_KEYS_PATH, () =>
  errorResponse(API_ERROR_CODE.INTERNAL_ERROR, 'Internal server error', {
    requestId: 'req-server',
  }),
);

/** Network failure — the request never reaches a server (`status: null`). */
export const apiKeysListNetworkError = http.get(API_KEYS_PATH, () =>
  HttpResponse.error(),
);

/**
 * `200` body that is not a success envelope — the client must reject it as
 * `UNEXPECTED_PAYLOAD` (the transport really runs the envelope unwrap).
 */
export const apiKeysListMalformedPayload = http.get(API_KEYS_PATH, () =>
  HttpResponse.json({ items: VALID_API_KEY_PAIR }),
);

/** `201` create echoing the submitted payload back as a stored key. */
export const apiKeysCreateSuccess = http.post(
  API_KEYS_PATH,
  async ({ request }) => {
    const input = (await request.json()) as CreateApiKeyInput;

    return successResponse(createdApiKey(input), { status: 201 });
  },
);

/** `409` duplicate identifier, addressed to the `identifier` field. */
export const apiKeysCreateConflict = http.post(API_KEYS_PATH, () =>
  errorResponse(
    API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT,
    'identifier already exists',
    {
      details: [{ path: 'identifier', message: CONFLICT_DETAIL }],
      requestId: 'req-conflict',
    },
  ),
);

/**
 * Legacy `409`: the domain code is present, but no `details[]` says which field
 * is at fault — the client must fall back to the code's default path.
 */
export const apiKeysCreateLegacyConflict = http.post(API_KEYS_PATH, () =>
  errorResponse(
    API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT,
    'identifier already exists',
    { requestId: 'req-legacy-conflict' },
  ),
);

/** `400` blaming one addressable field. */
export const apiKeysCreateFieldValidation = http.post(API_KEYS_PATH, () =>
  errorResponse(
    API_ERROR_CODE.VALIDATION_FAILED,
    'The request payload does not match the API contract.',
    {
      details: [{ path: 'identifier', message: VALIDATION_DETAIL }],
    },
  ),
);

/**
 * `400` blaming two addressable fields and one unknown path — the unknown path
 * must surface as the page-level alert, not as a field error.
 */
export const apiKeysCreateMultiFieldValidation = http.post(API_KEYS_PATH, () =>
  errorResponse(
    API_ERROR_CODE.VALIDATION_FAILED,
    'The request payload does not match the API contract.',
    {
      details: [
        {
          path: 'name',
          message: 'String must contain at least 1 character(s)',
        },
        {
          path: 'apiKey',
          message: 'String must contain at least 8 character(s)',
        },
        { path: 'metadata.owner', message: 'Unrecognized key' },
      ],
    },
  ),
);

/** `500` create failure. */
export const apiKeysCreateServerError = http.post(API_KEYS_PATH, () =>
  errorResponse(API_ERROR_CODE.INTERNAL_ERROR, 'Internal server error'),
);

/** Network failure on create — never resolves to a response. */
export const apiKeysCreateNetworkError = http.post(API_KEYS_PATH, () =>
  HttpResponse.error(),
);

/** Create that stays in flight forever — for the pending-state assertion. */
export const apiKeysCreatePending = http.post(API_KEYS_PATH, () =>
  delay('infinite'),
);

/** Default handler set registered by the global server. */
export const apiKeysHandlers = [
  apiKeysListSuccess,
  apiKeysDetailSuccess,
  apiKeysCreateSuccess,
] as const;
