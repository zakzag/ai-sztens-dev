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
  UpdateApiKeyInput,
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

/** `500` detail failure with a correlation id the retry tier can assert. */
export const apiKeysDetailServerError = http.get(
  API_KEYS_DETAIL_PATH_PATTERN,
  () =>
    errorResponse(API_ERROR_CODE.INTERNAL_ERROR, 'Internal server error', {
      requestId: 'req-detail-server',
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

/**
 * `updatedAt` a successful `PATCH` answers with.
 *
 * Deliberately **different** from the fixture row's value: the detail page keys
 * the edit form on `updatedAt` (AIS-131 `D5`), so a handler that echoed the same
 * version could not prove the remount happens.
 */
const UPDATED_AT_AFTER_WRITE = '2026-11-04T10:00:00.000Z';

/**
 * Applies a `PATCH` body to the fixture row, the way the server would.
 *
 * @param input - the validated body the client sent.
 * @returns the stored row with the new values and a newer `updatedAt`.
 */
function patchedApiKey(input: UpdateApiKeyInput): ApiKey {
  return {
    ...VALID_API_KEY,
    name: input.name ?? VALID_API_KEY.name,
    description:
      input.description === undefined
        ? VALID_API_KEY.description
        : input.description,
    expiresAt:
      input.expiresAt === undefined ? VALID_API_KEY.expiresAt : input.expiresAt,
    updatedAt: UPDATED_AT_AFTER_WRITE,
  };
}

/** `200` update echoing the patched row with a newer `updatedAt`. */
export const apiKeysUpdateSuccess = http.patch(
  API_KEYS_DETAIL_PATH_PATTERN,
  async ({ request }) => {
    const input = (await request.json()) as UpdateApiKeyInput;

    return successResponse(patchedApiKey(input));
  },
);

/**
 * `409 STALE_WRITE` — the `updatedAt` the client sent is no longer current.
 *
 * The envelope names `updatedAt` on purpose: the client must **not** render that
 * as a field error (the input does not exist), which is exactly what the page
 * test asserts.
 */
export const apiKeysUpdateStaleWrite = http.patch(
  API_KEYS_DETAIL_PATH_PATTERN,
  () =>
    errorResponse(
      API_ERROR_CODE.STALE_WRITE,
      'updatedAt does not match the stored version',
      {
        details: [{ path: 'updatedAt', message: 'Stale write' }],
        requestId: 'req-stale',
      },
    ),
);

/** Update that stays in flight forever — for the pending-state assertion. */
export const apiKeysUpdatePending = http.patch(
  API_KEYS_DETAIL_PATH_PATTERN,
  () => delay('infinite'),
);

/** `422 SEMANTIC_VALIDATION_FAILED` blaming the `expiresAt` field. */
export const apiKeysUpdateSemanticInvalid = http.patch(
  API_KEYS_DETAIL_PATH_PATTERN,
  () =>
    errorResponse(
      API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED,
      'expiresAt must be in the future',
      {
        details: [{ path: 'expiresAt', message: 'Must be in the future' }],
      },
    ),
);

/** `404` update — the identifier is gone. */
export const apiKeysUpdateNotFound = http.patch(
  API_KEYS_DETAIL_PATH_PATTERN,
  () =>
    errorResponse(API_ERROR_CODE.NOT_FOUND, 'API key was not found', {
      path: `${API_KEYS_PATH}/ghost`,
    }),
);

/** `200` delete — the success envelope carries `data: null`, never `204`. */
export const apiKeysDeleteSuccess = http.delete(
  API_KEYS_DETAIL_PATH_PATTERN,
  () => successResponse(null),
);

/** `404` delete — the identifier is gone (already deleted by someone else). */
export const apiKeysDeleteNotFound = http.delete(
  API_KEYS_DETAIL_PATH_PATTERN,
  () =>
    errorResponse(API_ERROR_CODE.NOT_FOUND, 'API key was not found', {
      path: `${API_KEYS_PATH}/ghost`,
    }),
);

/** Delete that stays in flight forever — for the pending-state assertion. */
export const apiKeysDeletePending = http.delete(
  API_KEYS_DETAIL_PATH_PATTERN,
  () => delay('infinite'),
);

/**
 * The version some other reader left behind — the row a stale write loses to.
 *
 * Both fields differ from {@link VALID_API_KEY}, because the edit overlay keys
 * its form on `updatedAt` (AIS-172): a handler that echoed the same version and
 * the same name could not prove that the refetch actually reached the inputs.
 */
export const API_KEY_AFTER_STALE_WRITE: ApiKey = {
  ...VALID_API_KEY,
  name: 'Vapi prod (közben mentve)',
  description: 'Egy másik szerkesztő mentette',
  updatedAt: '2026-11-06T09:30:00.000Z',
};

/**
 * Detail read where the **first** answer is the fixture row and every later one
 * is {@link API_KEY_AFTER_STALE_WRITE}.
 *
 * A factory rather than a constant on purpose: the counter belongs to one test,
 * so a second render in the same file starts from the original row again.
 *
 * @returns a handler for the single-resource route with per-instance state.
 */
export function createApiKeysDetailRefetchHandler(): ReturnType<
  typeof http.get
> {
  let readCount = 0;

  return http.get(API_KEYS_DETAIL_PATH_PATTERN, () => {
    readCount += 1;

    return successResponse(
      readCount === 1 ? VALID_API_KEY : API_KEY_AFTER_STALE_WRITE,
    );
  });
}

/** Default handler set registered by the global server. */
export const apiKeysHandlers = [
  apiKeysListSuccess,
  apiKeysDetailSuccess,
  apiKeysCreateSuccess,
  apiKeysUpdateSuccess,
  apiKeysDeleteSuccess,
] as const;
